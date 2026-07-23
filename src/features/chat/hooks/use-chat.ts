// src/features/chat/hooks/use-chat.ts
"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { DEFAULT_PROVIDER_SETTINGS } from "@/types";
import type { ChatMessage, MessageStatus, ProviderSettings } from "@/types";
import type { UploadedDocument } from "@/features/documents/types";
import type { KnowledgeItem } from "@/features/knowledge-bank/types";

interface UseChatOptions {
  providerId: string;
  conversationId: string;
  settings?: ProviderSettings;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  knowledgeItems?: KnowledgeItem[];
}

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "activity"; id: string; label: string; status: "active" | "done" }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Only handles per-message attachments now. Data-bank ("knowledge") context
 * is merged server-side (see /api/chat) so it doesn't need to be folded
 * into every message here.
 */
function withAttachmentContext(history: ChatMessage[]): ChatMessage[] {
  return history.map((m) => {
    const contextBlocks = (m.attachments ?? [])
      .filter((d) => d.selectedAsContext && d.extractedText)
      .map((d) => `<document name="${d.name}">\n${d.extractedText}\n</document>`)
      .join("\n\n");

    if (!contextBlocks) return m;
    return { ...m, content: m.content ? `${contextBlocks}\n\n${m.content}` : contextBlocks };
  });
}

export function useChat({
  providerId,
  conversationId,
  settings = DEFAULT_PROVIDER_SETTINGS,
  initialMessages = [],
  onMessagesChange,
  knowledgeItems = [],
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Tracks the last knowledgeItems payload we actually sent to the server
  // for this conversation, so we only re-send it when it's changed.
  const lastSyncedKnowledgeRef = useRef<string | null>(null);

  // Always call the *latest* onMessagesChange without needing it in
  // runCompletion's dependency array.
  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;

  /**
   * IMPORTANT: we intentionally do NOT sync to the parent via
   * `useEffect(() => onMessagesChange(messages), [messages])`.
   *
   * During streaming, `messages` gets a new array reference on every SSE
   * token. Wiring that through an effect means every token triggers the
   * parent's setState (a localStorage write + a full app re-render), and
   * under bursty streaming that cascade can exceed React's re-render guard
   * ("Maximum update depth exceeded"). Instead we call this explicitly, and
   * only at logical checkpoints — right after a user message is added, and
   * once when a stream finishes — never once per token.
   */
  const notifyParent = useCallback((next: ChatMessage[]) => {
    onMessagesChangeRef.current?.(next);
  }, []);

  const runCompletion = useCallback(
    async (history: ChatMessage[]) => {
      setError(null);
      setIsStreaming(true);

      const assistantId = uuid();
      const assistantCreatedAt = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: assistantCreatedAt,
          status: "streaming",
          model: settings.model,
          activity: [{ id: "thinking", label: "Thinking…", status: "active" }],
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      const isFirstTurn = !history.some((m) => m.role === "assistant");
      const knowledgeSignature = JSON.stringify(knowledgeItems.map((i) => [i.id, i.content, i.enabled]));
      const shouldSyncKnowledge = isFirstTurn || lastSyncedKnowledgeRef.current !== knowledgeSignature;

      // Accumulated deterministically alongside the streaming setMessages
      // calls, so the final parent-sync payload below is built directly
      // from known values instead of depending on when React commits state.
      const assistantContent = "";
      let finalStatus: MessageStatus = "streaming";

      const finish = () => {
        setIsStreaming(false);
        abortRef.current = null;
        if (finalStatus === "streaming") finalStatus = "done"; // stream closed with no explicit terminal event
        const finalMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: assistantContent,
          createdAt: assistantCreatedAt,
          status: finalStatus,
          model: settings.model,
        };
        notifyParent([...history, finalMessage]);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            messages: withAttachmentContext(history),
            settings,
            conversationId,
            ...(shouldSyncKnowledge ? { knowledgeItems } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        if (shouldSyncKnowledge) {
          lastSyncedKnowledgeRef.current = knowledgeSignature;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            const event = JSON.parse(json) as StreamEvent;

            if (event.type === "text") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const activity = (m.activity ?? []).map((a) =>
                    a.id === "thinking" && a.status === "active" ? { ...a, status: "done" as const } : a
                  );
                  return { ...m, content: m.content + event.text, activity };
                })
              );
            } else if (event.type === "activity") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const existing = m.activity ?? [];
                  const idx = existing.findIndex((a) => a.id === event.id);
                  const step = { id: event.id, label: event.label, status: event.status };
                  const activity =
                    idx === -1 ? [...existing, step] : existing.map((a, i) => (i === idx ? step : a));
                  return { ...m, activity };
                })
              );
            } else if (event.type === "error") {
              setError(event.message);
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const activity = (m.activity ?? []).map((a) =>
                    a.status === "active" ? { ...a, status: "done" as const } : a
                  );
                  return { ...m, status: "error", activity };
                })
              );
            } else if (event.type === "done") {
              finalStatus = "done";
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: "done" } : m)));
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || m.status !== "streaming") return m;
              const activity = (m.activity ?? []).map((a) =>
                a.status === "active" ? { ...a, status: "done" as const } : a
              );
              return { ...m, status: "stopped", activity };
            })
          );
        } else {
          const message = err instanceof Error ? err.message : "Something went wrong";
          setError(message);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              const activity = (m.activity ?? []).map((a) =>
                a.status === "active" ? { ...a, status: "done" as const } : a
              );
              return { ...m, status: "error", content: m.content || message, activity };
            })
          );
        }
      } finally {
        finish();
      }
    },
    [providerId, conversationId, settings, knowledgeItems, notifyParent]
  );

  const sendMessage = useCallback(
    (content: string, documents: UploadedDocument[] = []) => {
      if ((!content.trim() && documents.length === 0) || isStreaming) return;

      const userMessage: ChatMessage = {
        id: uuid(),
        role: "user",
        content: content.trim(),
        createdAt: Date.now(),
        status: "done",
        attachments: documents.length > 0 ? documents : undefined,
      };
      const history = [...messages, userMessage];
      setMessages(history);
      notifyParent(history);
      void runCompletion(history);
    },
    [messages, isStreaming, runCompletion, notifyParent]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(() => {
    if (isStreaming) return;
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const cutIdx = messages.length - 1 - lastAssistantIdx;
    const history = messages.slice(0, cutIdx);
    setMessages(history);
    notifyParent(history);
    void runCompletion(history);
  }, [isStreaming, messages, runCompletion, notifyParent]);

  const editMessage = useCallback(
    (id: string, newContent: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const history = [...messages.slice(0, idx), { ...messages[idx], content: newContent }];
      setMessages(history);
      notifyParent(history);
      void runCompletion(history);
    },
    [isStreaming, messages, runCompletion, notifyParent]
  );

  const retryMessage = useCallback(
    (id: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const cutIdx = messages[idx].role === "assistant" ? idx : idx + 1;
      const history = messages.slice(0, cutIdx);
      setMessages(history);
      notifyParent(history);
      void runCompletion(history);
    },
    [isStreaming, messages, runCompletion, notifyParent]
  );

  const clear = useCallback(() => {
    setMessages([]);
    notifyParent([]);
  }, [notifyParent]);

  return { messages, isStreaming, error, sendMessage, stop, regenerate, editMessage, retryMessage, clear };
}