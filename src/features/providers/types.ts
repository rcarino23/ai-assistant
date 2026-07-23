import type { ChatMessage, ProviderSettings } from "@/types";

/** A single chunk emitted while streaming a completion. */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "activity"; id: string; label: string; status: "active" | "done" }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ModelInfo {
  id: string;
  label: string;
  /** Rough context window, for display purposes only. */
  contextWindow?: number;
}

/**
 * Every AI provider (Anthropic, OpenAI, Gemini, Groq, Ollama, ...) implements
 * this interface. The UI and API route only ever talk to this contract, so
 * new providers can be dropped in without touching chat components.
 */
export interface AIProvider {
  id: string;
  name: string;
  models: ModelInfo[];
  supportsStreaming: boolean;

  /** Whether this provider has the credentials it needs (API key / endpoint). */
  isConfigured(): boolean;

  /** Stream a completion for the given conversation. */
  streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`Provider "${providerId}" is not configured. Add its API key to .env.local.`);
    this.name = "ProviderNotConfiguredError";
  }
}
