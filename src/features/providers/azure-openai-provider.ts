import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";

/**
 * Azure OpenAI doesn't expose a "list models" concept the way OpenAI does —
 * you call a specific *deployment* (a name you chose in the Azure portal
 * when deploying a base model). We can't know that name in advance, so the
 * single "model" entry here is really "your deployment," and
 * AZURE_OPENAI_DEPLOYMENT in .env.local is what actually gets called.
 */
const MODELS: ModelInfo[] = [{ id: "azure-deployment", label: "Your Azure Deployment" }];

const DEFAULT_API_VERSION = "2024-06-01";

interface AzureDelta {
  choices?: { delta?: { content?: string } }[];
}

interface AzureErrorBody {
  error?: { message?: string };
}

function parseAzureError(status: number, text: string): string {
  try {
    const body = JSON.parse(text) as AzureErrorBody;
    return body.error?.message || `Request failed (${status})`;
  } catch {
    return text || `Request failed (${status})`;
  }
}

function normalizeEndpoint(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Talks to an Azure OpenAI resource's chat completions endpoint, which is
 * OpenAI-compatible in payload/response shape but addressed differently:
 * https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=...
 * with the key passed as an `api-key` header rather than `Authorization: Bearer`.
 * Docs: https://learn.microsoft.com/azure/ai-services/openai/reference
 */
export class AzureOpenAIProvider implements AIProvider {
  id = "azure-openai";
  name = "Azure OpenAI";
  models = MODELS;
  supportsStreaming = true;

  isConfigured(): boolean {
    return Boolean(
      process.env.AZURE_OPENAI_API_KEY &&
        process.env.AZURE_OPENAI_ENDPOINT &&
        process.env.AZURE_OPENAI_DEPLOYMENT
    );
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: ProviderSettings,
    signal: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const endpoint = normalizeEndpoint(process.env.AZURE_OPENAI_ENDPOINT as string);
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT as string;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

    const apiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
      content: m.content,
    }));

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_OPENAI_API_KEY as string,
        },
        body: JSON.stringify({
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
      const message = err instanceof Error ? err.message : "Network error contacting Azure OpenAI";
      yield { type: "error", message };
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", message: parseAzureError(res.status, text) };
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
            const parsed = JSON.parse(json) as AzureDelta;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield { type: "text", text: delta };
            }
          } catch {
            // Ignore malformed/keep-alive lines (Azure sends an empty
            // first event with just role info on some API versions).
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