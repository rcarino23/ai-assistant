import type { SavedPrompt } from "./types";

const STORAGE_KEY = "ai-assistant:prompts";

export function loadPrompts(defaults: SavedPrompt[]): SavedPrompt[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPrompt[]) : defaults;
  } catch {
    return defaults;
  }
}

export function savePrompts(prompts: SavedPrompt[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}