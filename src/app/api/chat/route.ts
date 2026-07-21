import { NextRequest } from "next/server";
import { getProvider } from "@/features/providers/registry";
import type { ChatMessage, ProviderSettings } from "@/types";

export const runtime = "nodejs";

interface ChatRequestBody {
  providerId: string;
  messages: ChatMessage[];
  settings: ProviderSettings;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatRequestBody;
  const { providerId, messages, settings } = body;

  const provider = getProvider(providerId);
  if (!provider) {
    return new Response(JSON.stringify({ error: `Unknown provider "${providerId}"` }), {
      status: 400,
    });
  }
  if (!provider.isConfigured()) {
    return new Response(
      JSON.stringify({ error: `${provider.name} is not configured. Add its API key to .env.local.` }),
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of provider.streamChat(messages, settings, abortController.signal)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === "done" || event.type === "error") break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
