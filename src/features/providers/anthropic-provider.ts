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

    function buildMessageContent(m: ChatMessage): string | Anthropic.MessageParam["content"] {
    const textDocs = (m.attachments ?? []).filter((a) => a.selectedAsContext && a.extractedText);
    if (textDocs.length === 0) return m.content;

      const blocks: Anthropic.ContentBlockParam[] = textDocs.map((doc) => ({
        type: "document",
        title: doc.name,
        source: {
          type: "text",
          media_type: "text/plain",
          data: doc.extractedText,
        },
      }));

      if (m.content) blocks.push({ type: "text", text: m.content });
      return blocks;
    }

    const systemMessage = messages.find((m) => m.role === "system");
    let conversation: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: buildMessageContent(m),
      }));

    const client = this.client();
    const tools = isDatabaseConfigured() ? [DATABASE_TOOL] : undefined;

    let thinkingResolved = false;

    try {
      for (let turn = 0; turn < 5; turn++) {
        if (turn === 0) {
          yield { type: "activity", id: "thinking", label: "Thinking…", status: "active" };
        }

        const stream = client.beta.messages.stream(
          {
            model: settings.model || "claude-sonnet-4-6",
            max_tokens: settings.maxTokens ?? 4096,
            temperature: settings.temperature ?? 0.7,
            top_p: settings.topP ?? 1,
            system: systemMessage?.content,
            messages: conversation as Anthropic.Beta.BetaMessageParam[],
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