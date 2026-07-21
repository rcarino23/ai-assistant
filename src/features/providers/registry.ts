import type { AIProvider } from "./types";
import { AnthropicProvider } from "./anthropic-provider";
import { StubProvider } from "./stub-provider";

/**
 * Single source of truth for "which providers exist". Add a new provider by
 * pushing an entry here (and, once implemented, swapping StubProvider for a
 * real class like AnthropicProvider) — nothing in the UI needs to change.
 */
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
  new StubProvider(
    "openrouter",
    "OpenRouter",
    [{ id: "openrouter/auto", label: "Auto" }],
    "OPENROUTER_API_KEY"
  ),
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

/** Client-safe summary (no server logic, no env checks leak keys). */
export function getProviderSummaries() {
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    models: p.models,
    configured: p.isConfigured(),
  }));
}
