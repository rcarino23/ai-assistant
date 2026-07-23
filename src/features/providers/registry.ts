// src/features/providers/registry.ts
import type { AIProvider } from "./types";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import { StubProvider } from "./stub-provider";

const openRouterProvider = new OpenRouterProvider();

const providers: AIProvider[] = [
  new AnthropicProvider(),
  new StubProvider(
    "openai",
    "OpenAI",
    [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ],
    "OPENAI_API_KEY"
  ),
  new StubProvider(
    "gemini",
    "Google Gemini",
    [{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }],
    "GEMINI_API_KEY"
  ),
  new StubProvider(
    "groq",
    "Groq",
    [{ id: "llama-3.3-70b", label: "Llama 3.3 70B" }],
    "GROQ_API_KEY"
  ),
  openRouterProvider,
  new StubProvider(
    "ollama",
    "Ollama (local)",
    [{ id: "llama3.2", label: "Llama 3.2" }],
    "OLLAMA_ENDPOINT"
  ),
  new StubProvider(
    "azure-openai",
    "Azure OpenAI",
    [{ id: "gpt-4o", label: "GPT-4o" }],
    "AZURE_OPENAI_API_KEY"
  ),
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