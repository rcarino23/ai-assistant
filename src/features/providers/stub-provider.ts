import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";

/**
 * Placeholder for providers described in the product spec (OpenAI, Gemini,
 * Groq, OpenRouter, Ollama, Azure OpenAI) that are not wired up yet.
 *
 * They already appear in the UI (correctly shown as "disabled" since
 * isConfigured() is false) and satisfy the AIProvider contract, so turning
 * one "on" later is just: implement streamChat the way AnthropicProvider
 * does, and flip isConfigured() to check the right env var.
 */
export class StubProvider implements AIProvider {
  supportsStreaming = true;

  constructor(
    public id: string,
    public name: string,
    public models: ModelInfo[],
    private envVar: string
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env[this.envVar]);
  }

  // eslint-disable-next-line require-yield
  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    void messages;
    void settings;
    void signal;
    throw new ProviderNotConfiguredError(this.id);
  }
}
