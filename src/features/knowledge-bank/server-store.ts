import type { KnowledgeItem } from "./types";

/**
 * In-memory, server-side cache of each conversation's data-bank items.
 *
 * The client only pushes the full item list on the first message of a
 * conversation, or whenever the items change (see useChat's
 * `lastSyncedKnowledgeRef`). Every other turn just references
 * `conversationId` and the server reuses what's cached here, instead of
 * re-uploading the (potentially large) data bank content on every request.
 *
 * NOTE: process-local Map — fine for a single Node server, but won't
 * survive a restart or work across multiple serverless instances. Swap in
 * Redis / a DB table if you need that.
 */
const store = new Map<string, KnowledgeItem[]>();

export function setKnowledgeItems(conversationId: string, items: KnowledgeItem[]) {
  store.set(conversationId, items);
}

export function getKnowledgeItems(conversationId: string): KnowledgeItem[] {
  return store.get(conversationId) ?? [];
}

export function clearKnowledgeItems(conversationId: string) {
  store.delete(conversationId);
}