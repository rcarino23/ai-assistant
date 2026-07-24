import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { withAttachmentText, imageAttachments } from "./message-content";

const MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 1_048_576 },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1_048_576 },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", contextWindow: 1_048_576 },
];

interface GeminiPart {
  text?: string;
}

interface GeminiStreamChunk {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiErrorBody {
  error?: { message?: string };
}

interface GeminiOutgoingPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

function parseGeminiError(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as GeminiErrorBody;
    return body.error?.message || `Request failed (${status})`;
  } catch {
    return text || `Request failed (${status})`;
  }
}

/**
 * Talks to Google's Generative Language REST API directly over fetch/SSE
 * rather than pulling in the @google/generative-ai SDK, to keep this
 * consistent with OpenRouterProvider's dependency-free approach.
 * Docs: https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent
 *
 * Gemini's request/response shape differs from the OpenAI-style providers:
 * - "contents" instead of "messages", with role "model" instead of "assistant"
 * - system prompt is a separate top-level "systemInstruction" field
 * - streaming responses are an SSE stream of full JSON candidate objects,
 *   not incremental deltas, so each chunk's text is emitted as-is
 */
export class GeminiProvider implements AIProvider {
  id = "gemini";
  name = "Google Gemini";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
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
    // const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

    const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
        const role = m.role === "assistant" ? "model" : "user";
        const images = imageAttachments(m);
        const textContent = withAttachmentText(m);

        const parts: GeminiOutgoingPart[] = [
          ...images.map((img) => ({
            inlineData: { mimeType: img.mediaType as string, data: img.base64Data as string },
          })),
          ...(textContent ? [{ text: textContent }] : []),
        ];

        return { role, parts };
    });

    const model = settings.model || "gemini-2.5-flash";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
      `?alt=sse&key=${process.env.GEMINI_API_KEY}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
          generationConfig: {
            temperature: settings.temperature ?? 0.7,
            topP: settings.topP ?? 1,
            maxOutputTokens: settings.maxTokens ?? 4096,
          },
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Network error contacting Gemini";
      yield { type: "error", message };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: parseGeminiError(res.status, text) };
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
          if (!json) continue;

          try {
            const parsed = JSON.parse(json) as GeminiStreamChunk;

            if (parsed.promptFeedback?.blockReason) {
              yield { type: "error", message: `Blocked by Gemini: ${parsed.promptFeedback.blockReason}` };
              return;
            }

            const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
            if (text) {
              yield { type: "text", text };
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