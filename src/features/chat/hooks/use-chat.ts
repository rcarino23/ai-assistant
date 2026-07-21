"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { DEFAULT_PROVIDER_SETTINGS } from "@/types";
import type { ChatMessage, ProviderSettings } from "@/types";
import type { UploadedDocument } from "@/features/documents/types";

interface UseChatOptions {
  providerId: string;
  settings?: ProviderSettings;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function useChat({
  providerId,
  settings = DEFAULT_PROVIDER_SETTINGS,
  initialMessages = [],
  onMessagesChange,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  React.useEffect(() => {
    onMessagesChange?.(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const runCompletion = useCallback(
    async (history: ChatMessage[]) => {
      setError(null);
      setIsStreaming(true);

      const assistantId = uuid();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          status: "streaming",
          model: settings.model,
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId, messages: history, settings }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(data.error || `Request failed (${res.status})`);
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
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m))
              );
            } else if (event.type === "error") {
              setError(event.message);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, status: "error" } : m))
              );
            } else if (event.type === "done") {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: "done" } : m)));
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId && m.status === "streaming" ? { ...m, status: "stopped" } : m))
          );
        } else {
          const message = err instanceof Error ? err.message : "Something went wrong";
          setError(message);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, status: "error", content: m.content || message } : m))
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [providerId, settings]
  );

  const sendMessage = useCallback(
    (content: string, documents: UploadedDocument[] = []) => {
      if ((!content.trim() && documents.length === 0) || isStreaming) return;

      const contextBlocks = documents
        .filter((d) => d.selectedAsContext && d.extractedText)
        .map((d) => `<document name="${d.name}">\n${d.extractedText}\n</document>`)
        .join("\n\n");

      const finalContent = contextBlocks ? `${contextBlocks}\n\n${content}` : content;

      const userMessage: ChatMessage = {
        id: uuid(),
        role: "user",
        content: finalContent,
        createdAt: Date.now(),
        status: "done",
      };
      const history = [...messages, userMessage];
      setMessages(history);
      void runCompletion(history);
    },
    [messages, isStreaming, runCompletion]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Drop the last assistant reply and ask the model to try again. */
  const regenerate = useCallback(() => {
    if (isStreaming) return;
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const cutIdx = messages.length - 1 - lastAssistantIdx;
    const history = messages.slice(0, cutIdx);
    setMessages(history);
    void runCompletion(history);
  }, [isStreaming, messages, runCompletion]);

  /** Edit a past user message and re-run the conversation from that point. */
  const editMessage = useCallback(
    (id: string, newContent: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const history = [...messages.slice(0, idx), { ...messages[idx], content: newContent }];
      setMessages(history);
      void runCompletion(history);
    },
    [isStreaming, messages, runCompletion]
  );

  /** Retry a failed/stopped message (assistant) or a user message's response. */
  const retryMessage = useCallback(
    (id: string) => {
      if (isStreaming) return;
      const idx = messages.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const cutIdx = messages[idx].role === "assistant" ? idx : idx + 1;
      const history = messages.slice(0, cutIdx);
      setMessages(history);
      void runCompletion(history);
    },
    [isStreaming, messages, runCompletion]
  );

  const clear = useCallback(() => setMessages([]), []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stop,
    regenerate,
    editMessage,
    retryMessage,
    clear,
  };
}
