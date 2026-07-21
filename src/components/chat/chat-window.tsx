"use client";

import * as React from "react";
import type { ChatMessage, ProviderSettings } from "@/types";
import { useChat } from "@/features/chat/hooks/use-chat";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

interface ChatWindowProps {
  providerId: string;
  providerConfigured: boolean;
  providerName: string;
  settings: ProviderSettings;
  initialMessages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export function ChatWindow({
  providerId,
  providerConfigured,
  providerName,
  settings,
  initialMessages,
  onMessagesChange,
}: ChatWindowProps) {
  const { messages, isStreaming, error, sendMessage, stop, regenerate, editMessage, retryMessage } = useChat({
    providerId,
    settings,
    initialMessages,
    onMessagesChange,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} onEdit={editMessage} onRetry={retryMessage} onRegenerate={regenerate} />
      </div>

      {error && (
        <p className="mx-auto mb-2 w-full max-w-3xl px-4 text-center text-xs text-red-500">{error}</p>
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
