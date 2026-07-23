// src/components/chat/chat-window.tsx
"use client";

import * as React from "react";
import type { ChatMessage, ProviderSettings } from "@/types";
import { useChat } from "@/features/chat/hooks/use-chat";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { ErrorModal } from "./error-modal";
import type { KnowledgeItem } from "@/features/knowledge-bank/types";

interface ChatWindowProps {
  conversationId: string;
  providerId: string;
  providerConfigured: boolean;
  providerName: string;
  settings: ProviderSettings;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  knowledgeItems: KnowledgeItem[];
}

export function ChatWindow({
  conversationId,
  providerId,
  providerConfigured,
  providerName,
  settings,
  initialMessages,
  onMessagesChange,
  knowledgeItems,
}: ChatWindowProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stop,
    regenerate,
    editMessage,
    retryMessage,
    dismissError,
  } = useChat({
    providerId,
    conversationId,
    settings,
    initialMessages,
    onMessagesChange,
    knowledgeItems,
  });

  // The failed turn always leaves an assistant message behind (see
  // useChat.runCompletion), so regenerate() has something to re-run from
  // whenever an error is showing.
  const canRetry = messages.some((m) => m.role === "assistant");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          scrollContainerRef={scrollContainerRef}
          onEdit={editMessage}
          onRetry={retryMessage}
          onRegenerate={regenerate}
        />
      </div>

      {error && (
        <ErrorModal message={error} onClose={dismissError} onRetry={canRetry ? regenerate : undefined} />
      )}

      <MessageInput
        isStreaming={isStreaming}
        disabled={!providerConfigured}
        disabledReason={
          !providerConfigured ? `Add an API key for ${providerName} in .env.local to start chatting.` : undefined
        }
        onSend={sendMessage}
        onStop={stop}
      />
    </div>
  );
}