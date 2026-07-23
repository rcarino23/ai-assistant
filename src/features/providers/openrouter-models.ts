// src/features/providers/openrouter-models.ts
import type { ModelInfo } from "./types";

/**
 * Fallback list used only if OpenRouter's public models API is unreachable
 * (no network, endpoint shape changes, etc). OpenRouter's free-model lineup
 * rotates fairly often — models get added/retired with little notice — so
 * this is deliberately small and treated as a last resort. The real list
 * always comes from the live API below.
 */
const FALLBACK_FREE_MODELS: ModelInfo[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (Free)", contextWindow: 131_072 },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash Exp (Free)", contextWindow: 1_048_576 },
  { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (Free)", contextWindow: 32_768 },
];

interface OpenRouterModelsResponse {
  data?: {
    id: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
  }[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — free lineup doesn't change minute to minute
const FETCH_TIMEOUT_MS = 5_000;

let cache: { models: ModelInfo[]; fetchedAt: number } | null = null;

function isZeroCost(pricing?: { prompt?: string; completion?: string }): boolean {
  if (!pricing) return false;
  return Number(pricing.prompt ?? "1") === 0 && Number(pricing.completion ?? "1") === 0;
}

async function fetchFreeModelsFromOpenRouter(): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenRouter models request failed (${res.status})`);

    const body = (await res.json()) as OpenRouterModelsResponse;

    const freeModels = (body.data ?? [])
      // Belt-and-suspenders: OpenRouter tags free-tier IDs with a ":free"
      // suffix, but we also verify pricing is actually zero.
      .filter((m) => m.id.endsWith(":free") && isZeroCost(m.pricing))
      .map(
        (m): ModelInfo => ({
          id: m.id,
          label: m.name ? `${m.name} (Free)` : m.id,
          contextWindow: m.context_length,
        })
      )
      .sort((a, b) => a.label.localeCompare(b.label));

    return freeModels.length > 0 ? freeModels : FALLBACK_FREE_MODELS;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns the current free-model list, refreshing from OpenRouter's public
 * API at most once per CACHE_TTL_MS. Falls back to the last known-good
 * cache (or the static seed list) if the live fetch fails, so a transient
 * OpenRouter/network hiccup never breaks the model picker.
 */
export async function getFreeModels(): Promise<ModelInfo[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.models;
  }

  try {
    const models = await fetchFreeModelsFromOpenRouter();
    cache = { models, fetchedAt: now };
    return models;
  } catch {
    return cache?.models ?? FALLBACK_FREE_MODELS;
  }
}

/** Synchronous accessor for contexts that can't await (e.g. constructors). */
export function getCachedFreeModels(): ModelInfo[] {
  return cache?.models ?? FALLBACK_FREE_MODELS;
}