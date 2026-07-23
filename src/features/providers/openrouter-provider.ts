// src/features/providers/openrouter-provider.ts
import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { getFreeModels, getCachedFreeModels } from "./openrouter-models";

const DEFAULT_MODEL = "openrouter/auto";
const MAX_MODEL_ATTEMPTS = 3; // how many free models to try before giving up

/** Curated, hand-picked popular paid models — kept static since these are
 * stable, well-known IDs rather than a rotating catalog. */
const PAID_MODELS: ModelInfo[] = [
  { id: "openrouter/auto", label: "Auto (OpenRouter picks a model)" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", contextWindow: 200_000 },
  { id: "openai/gpt-4o", label: "GPT-4o", contextWindow: 128_000 },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
];

interface OpenRouterDelta {
  choices?: { delta?: { content?: string } }[];
}

interface OpenRouterErrorInfo {
  message: string;
  isRateLimit: boolean;
  retryAfterSeconds?: number;
}

/**
 * OpenRouter's error body for a rate limit looks like:
 * { error: { code: 429, metadata: { raw, retry_after_seconds, provider_name } } }
 * This turns that into something we can act on and show to the user cleanly,
 * instead of dumping the raw JSON into the chat as an error string.
 */
function parseOpenRouterError(status: number, text: string): OpenRouterErrorInfo {
  const isRateLimit = status === 429;
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string; metadata?: { raw?: string; retry_after_seconds?: number } };
    };
    const message = body.error?.metadata?.raw || body.error?.message || `Request failed (${status})`;
    return { message, isRateLimit, retryAfterSeconds: body.error?.metadata?.retry_after_seconds };
  } catch {
    return { message: text || `Request failed (${status})`, isRateLimit };
  }
}

/**
 * OpenRouter exposes an OpenAI-compatible chat completions endpoint, so this
 * talks to it directly over fetch/SSE rather than pulling in an extra SDK.
 * Docs: https://openrouter.ai/docs
 *
 * `models` = a static list of well-known paid models, plus OpenRouter's live
 * "zero cost" catalog appended after (see openrouter-models.ts).
 */
export class OpenRouterProvider implements AIProvider {
  id = "openrouter";
  name = "OpenRouter";
  models: ModelInfo[] = [...PAID_MODELS, ...getCachedFreeModels()];
  supportsStreaming = true;

  async refreshModels(): Promise<void> {
    const freeModels = await getFreeModels();
    this.models = [...PAID_MODELS, ...freeModels];
  }

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

    const requestedModel = settings.model || DEFAULT_MODEL;

    // Free models are each served by a specific upstream provider (the
    // "provider_name" in OpenRouter's error, e.g. "Darkbloom"), and that
    // provider can be briefly overloaded independent of the others. If the
    // requested model is free and gets rate-limited, try a couple of other
    // free models before giving up — a different upstream is likely fine.
    const fallbackCandidates = requestedModel.endsWith(":free")
      ? this.models.map((m) => m.id).filter((id) => id.endsWith(":free") && id !== requestedModel)
      : [];
    const candidateModels = [requestedModel, ...fallbackCandidates].slice(0, MAX_MODEL_ATTEMPTS);

    let lastError: OpenRouterErrorInfo | null = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const isLastAttempt = i === candidateModels.length - 1;

      let res: Response;
      try {
        res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
            "X-Title": process.env.OPENROUTER_APP_NAME || "AI Assistant",
          },
          body: JSON.stringify({
            model,
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
        const message = err instanceof Error ? err.message : "Network error contacting OpenRouter";
        yield { type: "error", message };
        return;
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        const info = parseOpenRouterError(res.status, text);
        lastError = info;

        // Rate limited, and there's another free model left to try → move
        // on quietly instead of failing the whole request.
        if (info.isRateLimit && !isLastAttempt) continue;

        const retrySuffix = info.retryAfterSeconds ? ` Retry in about ${info.retryAfterSeconds}s.` : "";
        const triedSuffix = candidateModels.length > 1 ? ` (tried ${candidateModels.length} free models)` : "";
        yield {
          type: "error",
          message: info.isRateLimit
            ? `"${model}" is temporarily rate-limited by its upstream provider${triedSuffix}.${retrySuffix} ` +
              `You can add your own key at openrouter.ai/settings/integrations for higher free-tier limits.`
            : info.message,
        };
        return;
      }

      // Let the user know we silently swapped models due to rate limiting.
      if (model !== requestedModel) {
        yield {
          type: "text",
          text: `_${requestedModel} was rate-limited, so this reply used ${model} instead._\n\n`,
        };
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
      } catch (err) {
        if (signal.aborted) return;
        const message = err instanceof Error ? err.message : "Stream interrupted";
        yield { type: "error", message };
        return;
      }

      yield { type: "done" };
      return;
    }

    // Defensive fallback — the loop above always returns, but just in case.
    yield { type: "error", message: lastError?.message ?? "OpenRouter request failed." };
  }
}