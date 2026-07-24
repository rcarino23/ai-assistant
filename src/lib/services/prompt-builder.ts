import type { ChatMessage } from "@/types";

export function buildMessages(params: {
  systemPrompt: string;
  contextText: string;
  history: ChatMessage[];   // already condensed by history-condenser.ts
  questionMessage: ChatMessage;
}): ChatMessage[] {
  const system: ChatMessage = {
    id: "rag-system",
    role: "system",
    content: [
      params.systemPrompt.trim(),
      params.contextText
        ? `\n\nData bank context (use the bracketed source labels to ground answers; if the answer isn't in the context, say so instead of guessing):\n\n${params.contextText}`
        : "",
    ].join(""),
    createdAt: 0,
  };

  return [system, ...params.history, {
    ...params.questionMessage,
    id: params.questionMessage.id || "user-question",
    role: "user",
    content: params.questionMessage.content,
    createdAt: params.questionMessage.createdAt || Date.now(),
  }];
}