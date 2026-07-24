import type { ChatMessage } from "@/types";
import type { AIProvider } from "@/features/providers/types";

const RECENT_KEEP = 12; // last N non-system messages always sent verbatim
const CONDENSE_THRESHOLD = 20; // only start condensing once history exceeds this
const SUMMARY_MAX_TOKENS = 400;

interface ConversationSummaryState {
  /** id of the last message that's been folded into summaryText */
  summarizedThroughId: string;
  summaryText: string;
}

/**
 * In-memory, per-conversation cache of the rolling summary used to condense
 * history for non-Anthropic providers. Process-local — same caveat as
 * knowledge-bank/server-store.ts: fine for a single Node server, won't
 * survive a restart or work across multiple serverless instances.
 */
const summaryStore = new Map<string, ConversationSummaryState>();

export function clearConversationSummary(conversationId: string) {
  summaryStore.delete(conversationId);
}

async function summarizeWithProvider(
  provider: AIProvider,
  priorSummary: string | null,
  messagesToFold: ChatMessage[]
): Promise<string> {
  const transcript = messagesToFold.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const prompt = priorSummary
    ? `Here is a running summary of an earlier part of a conversation:\n\n${priorSummary}\n\nUpdate it to also incorporate the following additional messages. Stay concise (a few short paragraphs, plain prose, no preamble, no headers):\n\n${transcript}`
    : `Summarize the following conversation concisely (a few short paragraphs, plain prose, no preamble, no headers) so it can be used as context for continuing the conversation later:\n\n${transcript}`;

  const summaryRequestMessages: ChatMessage[] = [
    { id: "summary-request", role: "user", content: prompt, createdAt: Date.now() },
  ];

  let text = "";
  const controller = new AbortController();
  try {
    for await (const event of provider.streamChat(
      summaryRequestMessages,
      { model: "", temperature: 0.2, maxTokens: SUMMARY_MAX_TOKENS, topP: 1 },
      controller.signal
    )) {
      if (event.type === "text") text += event.text;
      if (event.type === "done" || event.type === "error") break;
    }
  } catch {
    // Best-effort — if the summarization call itself fails, keep whatever
    // summary we already had rather than breaking the real request.
    return priorSummary ?? "";
  }
  return text.trim() || priorSummary || "";
}

/**
 * Folds everything except the system message(s) and the most recent
 * RECENT_KEEP messages into a single running summary, so the request sent
 * to non-Anthropic providers stays roughly constant-size instead of growing
 * with the whole conversation. No-ops until the conversation is actually
 * long enough for it to matter.
 */
export async function condenseHistoryForProvider(
  messages: ChatMessage[],
  conversationId: string,
  provider: AIProvider
): Promise<ChatMessage[]> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length <= CONDENSE_THRESHOLD) return messages;

  const recent = nonSystem.slice(-RECENT_KEEP);
  const older = nonSystem.slice(0, nonSystem.length - RECENT_KEEP);
  if (older.length === 0) return messages;

  const existing = summaryStore.get(conversationId) ?? null;
  const alreadyFoldedCount = existing
    ? older.findIndex((m) => m.id === existing.summarizedThroughId) + 1
    : 0;
  const newlyFolded = older.slice(alreadyFoldedCount);

  let summaryText = existing?.summaryText ?? "";
  if (newlyFolded.length > 0) {
    summaryText = await summarizeWithProvider(provider, existing?.summaryText ?? null, newlyFolded);
    summaryStore.set(conversationId, {
      summarizedThroughId: older[older.length - 1].id,
      summaryText,
    });
  }

  const summaryMessage: ChatMessage = {
    id: "conversation-summary",
    role: "system",
    content: `Summary of earlier parts of this conversation (older messages were condensed to save tokens):\n\n${summaryText}`,
    createdAt: 0,
  };

  return [...systemMessages, summaryMessage, ...recent];
}