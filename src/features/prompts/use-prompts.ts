"use client";

import * as React from "react";
import { v4 as uuid } from "uuid";
import type { SavedPrompt } from "./types";
import { STARTER_PROMPTS } from "./types";
import { loadPrompts, savePrompts } from "./persistence";

export function usePrompts() {
  const [prompts, setPrompts] = React.useState<SavedPrompt[]>(STARTER_PROMPTS);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from localStorage once on mount (falls back to STARTER_PROMPTS
  // the first time the app runs, mirroring useChat's conversation hydration).
  React.useEffect(() => {
    setPrompts(loadPrompts(STARTER_PROMPTS));
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) savePrompts(prompts);
  }, [prompts, hydrated]);

  const addPrompt = React.useCallback((data: { title: string; template: string; folder?: string }) => {
    const prompt: SavedPrompt = {
      id: uuid(),
      title: data.title.trim(),
      template: data.template,
      folder: data.folder?.trim() || undefined,
      favorite: false,
      createdAt: Date.now(),
    };
    setPrompts((prev) => [prompt, ...prev]);
    return prompt;
  }, []);

  const updatePrompt = React.useCallback(
    (id: string, patch: Partial<Omit<SavedPrompt, "id" | "createdAt">>) => {
      setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    []
  );

  const deletePrompt = React.useCallback((id: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleFavorite = React.useCallback((id: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
  }, []);

  return { prompts, hydrated, addPrompt, updatePrompt, deletePrompt, toggleFavorite };
}