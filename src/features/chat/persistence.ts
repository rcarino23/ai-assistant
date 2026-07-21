import type { Conversation } from "@/types";

const STORAGE_KEY = "ai-assistant:conversations";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function deriveTitle(conversation: Conversation): string {
  const firstUserMessage = conversation.messages.find((m) => m.role === "user");
  return firstUserMessage ? firstUserMessage.content.slice(0, 60) : "New chat";
}
