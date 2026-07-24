// src/features/providers/groq-provider.ts
import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { withAttachmentText } from "./message-content";

const MODELS: ModelInfo[] = [
  { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B", contextWindow: 128_000 },
  { id: "openai/gpt-oss-20b", label: "OpenAI GPT-OSS 20B", contextWindow: 128_000 },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", contextWindow: 128_000 },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", contextWindow: 128_000 },
//   { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", contextWindow: 32_768 },
//   { id: "gemma2-9b-it", label: "Gemma 2 9B", contextWindow: 8_192 },
];

interface GroqDelta {
  choices?: { delta?: { content?: string } }[];
}

interface GroqErrorBody {
  error?: { message?: string };
}

function parseGroqError(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as GroqErrorBody;
    return body.error?.message || `Request failed (${status})`;
  } catch {
    return text || `Request failed (${status})`;
  }
}

/**
 * Groq exposes an OpenAI-compatible chat completions endpoint, so this
 * mirrors OpenRouterProvider/OpenAIProvider almost exactly.
 * Docs: https://console.groq.com/docs/api-reference#chat-create
 */
export class GroqProvider implements AIProvider {
  id = "groq";
  name = "Groq";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY);
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
      content: withAttachmentText(m),
    }));

    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: settings.model || "llama-3.3-70b-versatile",
          messages: apiMessages,
          temperature: settings.temperature ?? 0.7,
          top_p: settings.topP ?? 1,
          max_completion_tokens: settings.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Network error contacting Groq";
      yield { type: "error", message };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: parseGroqError(res.status, text) };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
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
            const parsed = JSON.parse(json) as GroqDelta;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield { type: "text", text: delta };
            }
          } catch {
            // Ignore malformed/keep-alive lines.
          }
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Stream interrupted";
      yield { type: "error", message };
      return;
    }

    yield { type: "done" };
  }
}