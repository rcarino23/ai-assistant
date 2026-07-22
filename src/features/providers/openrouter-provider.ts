import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";

/**
 * OpenRouter exposes an OpenAI-compatible chat completions endpoint, so this
 * talks to it directly over fetch/SSE rather than pulling in an extra SDK.
 * Docs: https://openrouter.ai/docs
 */
const MODELS: ModelInfo[] = [
  { id: "openrouter/auto", label: "Auto (OpenRouter picks a model)" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", contextWindow: 200_000 },
  { id: "openai/gpt-4o", label: "GPT-4o", contextWindow: 128_000 },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];

interface OpenRouterDelta {
  choices?: { delta?: { content?: string } }[];
}

export class OpenRouterProvider implements AIProvider {
  id = "openrouter";
  name = "OpenRouter";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const apiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
      content: m.content,
    }));

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          // Optional identification headers recommended by OpenRouter — safe to omit.
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_APP_NAME || "AI Assistant",
        },
        body: JSON.stringify({
          model: settings.model || "openrouter/auto",
          messages: apiMessages,
          temperature: settings.temperature ?? 0.7,
          top_p: settings.topP ?? 1,
          max_tokens: settings.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenRouter request failed (${res.status}): ${text || res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json || json === "[DONE]") continue;

          try {
            const parsed = JSON.parse(json) as OpenRouterDelta;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield { type: "text", text: delta };
            }
          } catch {
            // OpenRouter occasionally sends keep-alive/comment lines — ignore.
          }
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