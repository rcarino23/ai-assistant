import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";

const MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", contextWindow: 200_000 },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", contextWindow: 200_000 },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", contextWindow: 200_000 },
];

export class AnthropicProvider implements AIProvider {
  id = "anthropic";
  name = "Anthropic Claude";
  models = MODELS;
  supportsStreaming = true;

  private client(): Anthropic {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const systemMessage = messages.find((m) => m.role === "system");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    const client = this.client();

    try {
      const stream = client.messages.stream(
        {
          model: settings.model || "claude-sonnet-4-6",
          max_tokens: settings.maxTokens ?? 4096,
          temperature: settings.temperature ?? 0.7,
          top_p: settings.topP ?? 1,
          system: systemMessage?.content,
          messages: conversation,
        },
        { signal }
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }

      yield { type: "done" };
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown provider error";
      yield { type: "error", message };
    }
  }
}
