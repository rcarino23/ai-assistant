// src/features/providers/registry.ts
import type { AIProvider } from "./types";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { GroqProvider } from "./groq-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { OllamaProvider } from "./ollama-provider";
import { AzureOpenAIProvider } from "./azure-openai-provider";

const openRouterProvider = new OpenRouterProvider();

const providers: AIProvider[] = [
  new AnthropicProvider(),
  new OpenAIProvider(),
  new GeminiProvider(),
  new GroqProvider(),
  openRouterProvider,
  new OllamaProvider(),
  new AzureOpenAIProvider(),
];

export function getProviders(): AIProvider[] {
  return providers;
}

export function getProvider(id: string): AIProvider | undefined {
  return providers.find((p) => p.id === id);
}

/**
 * Client-safe summary (no server logic, no env checks leak keys).
 * Refreshes OpenRouter's free-model list first (best-effort — it has its
 * own 1hr cache and 5s timeout internally) so the model picker reflects the
 * current free lineup without ever blocking indefinitely if OpenRouter is
 * slow or unreachable.
 */
export async function getProviderSummaries() {
  if (openRouterProvider.isConfigured()) {
    await openRouterProvider.refreshModels().catch(() => {
      // Keep whatever list we already have (cache or static fallback).
    });
  }

  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    models: p.models,
    configured: p.isConfigured(),
  }));
}