"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types";
import { MessageItem } from "./message-item";

interface MessageListProps {
  messages: ChatMessage[];
  onEdit: (id: string, content: string) => void;
  onRetry: (id: string) => void;
  onRegenerate: () => void;
}

export function MessageList({ messages, onEdit, onRetry, onRegenerate }: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-ink">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-medium text-ink">Where should we start?</p>
          <p className="mt-1 text-sm text-muted">Ask a question, paste some text, or share a task.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col py-4">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isLastAssistant={message.id === lastAssistantId}
          onEdit={onEdit}
          onRetry={onRetry}
          onRegenerate={onRegenerate}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
