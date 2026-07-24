import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { isDatabaseConfigured, runReadOnlyQuery } from "@/features/database/registry";

const MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", contextWindow: 200_000 },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", contextWindow: 200_000 },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", contextWindow: 200_000 },
];

type AnthropicMessageContentBlock = {
  type: string;
  [key: string]: unknown;
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const DATABASE_TOOL: Anthropic.Tool = {
  name: "query_database",
  description:
    "Run a read-only SELECT query against the connected database (MySQL or SQL Server) and return the results. " +
    "Only read-only statements are allowed — SELECT/SHOW/DESCRIBE/EXPLAIN on MySQL, or SELECT/WITH on SQL Server. " +
    "Always cap results when exploring data (LIMIT on MySQL, TOP on SQL Server).",
  input_schema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "A single read-only SQL statement." },
    },
    required: ["sql"],
  },
};

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

    function textBlockWithCache(text: string): AnthropicMessageContentBlock {
      return { type: "text", text, cache_control: { type: "ephemeral" } };
    }

    /**
     * Marks a cache breakpoint at the second-to-last message in the
     * conversation. Anthropic caches everything up through that breakpoint, so
     * as the conversation grows turn over turn, only the newest message (plus
     * whatever's after the breakpoint) is billed at full price — the rest is
     * served from cache (~90% cheaper) as long as it's requested again within
     * the cache TTL. Applied fresh on every call rather than mutated in place,
     * so breakpoints don't accumulate across the tool-use loop below.
    */
    function withCacheControl(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
      if (messages.length < 2) return messages;
      const breakpointIndex = messages.length - 2;
      return messages.map((m, i) => {
        if (i !== breakpointIndex) return m;
        const content = m.content;
        if (typeof content === "string") {
          return { ...m, content: [textBlockWithCache(content)] } as unknown as Anthropic.MessageParam;
        }
        if (Array.isArray(content) && content.length > 0) {
          const blocks = [...content] as unknown as AnthropicMessageContentBlock[];
          const lastIdx = blocks.length - 1;
          blocks[lastIdx] = { ...blocks[lastIdx], cache_control: { type: "ephemeral" } };
          return { ...m, content: blocks } as unknown as Anthropic.MessageParam;
        }
        return m;
      });
    }

    function buildMessageContent(m: ChatMessage): string | AnthropicMessageContentBlock[] {
      const textDocs = (m.attachments ?? []).filter((a) => a.selectedAsContext && a.extractedText);
      const images = (m.attachments ?? []).filter(
        (a) => a.selectedAsContext && a.type === "image" && a.base64Data && a.mediaType && SUPPORTED_IMAGE_TYPES.has(a.mediaType)
      );

      if (textDocs.length === 0 && images.length === 0) return m.content;

      const blocks: AnthropicMessageContentBlock[] = [
        ...textDocs.map((doc) => ({
          type: "document",
          title: doc.name,
          source: { type: "text", media_type: "text/plain", data: doc.extractedText },
        })),
        ...images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.base64Data },
        })),
      ];

      if (m.content) blocks.push({ type: "text", text: m.content });
      return blocks;
    }

    const systemMessage = messages.find((m) => m.role === "system");
    let conversation: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: buildMessageContent(m) as Anthropic.MessageParam["content"],
      }));

    const client = this.client();
    const tools = isDatabaseConfigured() ? [DATABASE_TOOL] : undefined;

    let thinkingResolved = false;

    try {
      for (let turn = 0; turn < 5; turn++) {
        if (turn === 0) {
          yield { type: "activity", id: "thinking", label: "Thinking…", status: "active" };
        }

        const stream = client.messages.stream(
          {
            model: settings.model || "claude-sonnet-4-6",
            max_tokens: settings.maxTokens ?? 4096,
            temperature: settings.temperature ?? 0.7,
            top_p: settings.topP ?? 1,
            system: systemMessage
              ? ([textBlockWithCache(systemMessage.content)] as unknown as Anthropic.MessageCreateParams["system"])
              : undefined,
            messages: withCacheControl(conversation as Anthropic.MessageParam[]),
            tools,
          },
          { signal }
        );

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            if (!thinkingResolved) {
              thinkingResolved = true;
              yield { type: "activity", id: "thinking", label: "Thinking…", status: "done" };
            }
            yield { type: "text", text: event.delta.text };
          }
        }

        const finalMessage = await stream.finalMessage();

        if (finalMessage.stop_reason !== "tool_use") {
          if (!thinkingResolved) {
            thinkingResolved = true;
            yield { type: "activity", id: "thinking", label: "Thinking…", status: "done" };
          }
          yield { type: "done" };
          return;
        }

        // Model wants to call the database tool — surface that as its own step.
        if (!thinkingResolved) {
          thinkingResolved = true;
          yield { type: "activity", id: "thinking", label: "Thinking…", status: "done" };
        }

        conversation = [...conversation, { role: "assistant", content: finalMessage.content }];

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of finalMessage.content) {
          if (block.type !== "tool_use" || block.name !== "query_database") continue;
          const sqlInput = (block.input as { sql?: string }).sql ?? "";
          const shortSql = sqlInput.length > 80 ? `${sqlInput.slice(0, 80)}…` : sqlInput;
          const activityId = `tool-${block.id}`;

          yield { type: "activity", id: activityId, label: `Querying database: ${shortSql}`, status: "active" };

          try {
            const result = await runReadOnlyQuery(sqlInput);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
            yield { type: "activity", id: activityId, label: `Queried database: ${shortSql}`, status: "done" };
          } catch (err) {
            const message = err instanceof Error ? err.message : "Query failed";
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${message}`,
              is_error: true,
            });
            yield { type: "activity", id: activityId, label: `Database query failed: ${message}`, status: "done" };
          }
        }

        conversation = [...conversation, { role: "user", content: toolResults }];
        thinkingResolved = false; // next turn gets its own "Thinking…" step
      }

      yield { type: "error", message: "Tool loop limit reached without a final answer." };
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Unknown provider error";
      yield { type: "error", message };
    }
  }
}