import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";

const MODELS: ModelInfo[] = [
  { id: "gpt-4.1", label: "GPT-4.1", contextWindow: 1_047_576 },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", contextWindow: 1_047_576 },
  { id: "gpt-4o", label: "GPT-4o", contextWindow: 128_000 },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", contextWindow: 128_000 },
];

interface OpenAIDelta {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
}

interface OpenAIErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

function parseOpenAIError(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as OpenAIErrorBody;
    return body.error?.message || `Request failed (${status})`;
  } catch {
    return text || `Request failed (${status})`;
  }
}

/**
 * Talks directly to OpenAI's chat completions endpoint over fetch/SSE,
 * mirroring OpenRouterProvider's approach (OpenAI's own API is what
 * OpenRouter's shape is modeled on, so the parsing logic is nearly
 * identical). Docs: https://platform.openai.com/docs/api-reference/chat
 */
export class OpenAIProvider implements AIProvider {
  id = "openai";
  name = "OpenAI";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

    const apiMessages = messages.map((m) => {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    const images = (m.attachments ?? []).filter(
        (a) => a.type === "image" && a.base64Data && a.mediaType && SUPPORTED_IMAGE_TYPES.has(a.mediaType)
    );

    if (images.length === 0) {
        return { role, content: m.content };
    }

    return {
        role,
        content: [
        ...(m.content ? [{ type: "text", text: m.content }] : []),
        ...images.map((img) => ({
            type: "image_url",
            image_url: { url: `data:${img.mediaType};base64,${img.base64Data}` },
        })),
        ],
    };
    });

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...(process.env.OPENAI_ORG_ID ? { "OpenAI-Organization": process.env.OPENAI_ORG_ID } : {}),
        },
        body: JSON.stringify({
          model: settings.model || "gpt-4.1",
          messages: apiMessages,
          temperature: settings.temperature ?? 0.7,
          top_p: settings.topP ?? 1,
          max_tokens: settings.maxTokens ?? 4096,
          stream: true,
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Network error contacting OpenAI";
      yield { type: "error", message };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: parseOpenAIError(res.status, text) };
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
            const parsed = JSON.parse(json) as OpenAIDelta;
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