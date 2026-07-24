import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { withAttachmentText } from "./message-content";
/**
 * Static seed list — Ollama doesn't have a fixed catalog like hosted
 * providers; whatever the user has pulled locally (`ollama pull llama3.2`,
 * etc.) is what's actually available. These are just sensible defaults for
 * the model picker; typing/selecting any locally-pulled tag also works.
 */
const MODELS: ModelInfo[] = [
  { id: "llama3.2", label: "Llama 3.2" },
  { id: "llama3.1", label: "Llama 3.1" },
  { id: "qwen2.5", label: "Qwen 2.5" },
  { id: "mistral", label: "Mistral" },
];

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

function normalizeEndpoint(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Talks to a local (or self-hosted) Ollama server's native /api/chat
 * endpoint, which streams newline-delimited JSON objects (NDJSON) rather
 * than SSE "data:" frames — each line is a full JSON chunk with an
 * incremental message.content piece and a `done` flag on the last line.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md#chat-request-streaming
 */
export class OllamaProvider implements AIProvider {
  id = "ollama";
  name = "Ollama (local)";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(process.env.OLLAMA_ENDPOINT);
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const endpoint = normalizeEndpoint(process.env.OLLAMA_ENDPOINT as string);
    const apiMessages = messages.map((m) => {
        const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
        const images = (m.attachments ?? [])
            .filter((a) => a.type === "image" && a.base64Data)
            .map((a) => a.base64Data as string); // Ollama wants raw base64, no data: prefix — matches what we already store

        return {
          role,
          content: withAttachmentText(m),
          ...(images.length > 0 ? { images } : {}),
        };
    });

    let res: Response;
    try {
      res = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model || "llama3.2",
          messages: apiMessages,
          stream: true,
          options: {
            temperature: settings.temperature ?? 0.7,
            top_p: settings.topP ?? 1,
            num_predict: settings.maxTokens ?? 4096,
          },
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) return;
      const message =
        err instanceof Error
          ? `Couldn't reach Ollama at ${endpoint}: ${err.message}`
          : `Couldn't reach Ollama at ${endpoint}`;
      yield { type: "error", message };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: text || `Ollama request failed (${res.status})` };
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

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          try {
            const parsed = JSON.parse(line) as OllamaChatChunk;
            if (parsed.error) {
              yield { type: "error", message: parsed.error };
              return;
            }
            const text = parsed.message?.content;
            if (typeof text === "string" && text.length > 0) {
              yield { type: "text", text };
            }
          } catch {
            // Ignore malformed lines.
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