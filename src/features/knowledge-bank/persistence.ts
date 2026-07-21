import type { KnowledgeItem } from "./types";

const STORAGE_KEY = "ai-assistant:knowledge-bank";

export function loadKnowledgeItems(): KnowledgeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KnowledgeItem[]) : [];
  } catch {
    return [];
  }
}

export function saveKnowledgeItems(items: KnowledgeItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded on very large items — fail silently, in-memory state
    // for this session is still correct.
  }
}