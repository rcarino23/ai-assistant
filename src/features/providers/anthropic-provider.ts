import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ProviderSettings } from "@/types";
import type { AIProvider, ModelInfo, StreamEvent } from "./types";
import { ProviderNotConfiguredError } from "./types";
import { isDatabaseConfigured, runReadOnlyQuery } from "@/features/database/mysql-client";

const MODELS: ModelInfo[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", contextWindow: 200_000 },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", contextWindow: 200_000 },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", contextWindow: 200_000 },
];

const DATABASE_TOOL: Anthropic.Tool = {
  name: "query_database",
  description:
    "Run a read-only SELECT query against the connected MySQL database and return the results. " +
    "Only SELECT/SHOW/DESCRIBE/EXPLAIN statements are allowed. Always LIMIT results when exploring data.",
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

    const systemMessage = messages.find((m) => m.role === "system");
    let conversation: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    const client = this.client();
    const tools = isDatabaseConfigured() ? [DATABASE_TOOL] : undefined;

    try {
      // Loop: stream a turn; if Claude asks to use the tool, run it and
      // continue the same conversation with the tool result appended.
      // Cap iterations so a misbehaving loop can't run forever.
      for (let turn = 0; turn < 5; turn++) {
        const stream = client.messages.stream(
          {
            model: settings.model || "claude-sonnet-4-6",
            max_tokens: settings.maxTokens ?? 4096,
            temperature: settings.temperature ?? 0.7,
            top_p: settings.topP ?? 1,
            system: systemMessage?.content,
            messages: conversation,
            tools,
          },
          { signal }
        );

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }

        const finalMessage = await stream.finalMessage();

        if (finalMessage.stop_reason !== "tool_use") {
          yield { type: "done" };
          return;
        }

        // Execute any tool_use blocks, feed results back, then loop again.
        conversation = [...conversation, { role: "assistant", content: finalMessage.content }];

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of finalMessage.content) {
          if (block.type !== "tool_use" || block.name !== "query_database") continue;
          const sql = (block.input as { sql?: string }).sql ?? "";
          try {
            const result = await runReadOnlyQuery(sql);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Query failed";
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${message}`,
              is_error: true,
            });
          }
        }

        conversation = [...conversation, { role: "user", content: toolResults }];
      }

      yield { type: "error", message: "Tool loop limit reached without a final answer." };
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Unknown provider error";
      yield { type: "error", message };
    }
  }
}