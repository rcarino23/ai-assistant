import { NextRequest, NextResponse } from "next/server";
import { clearKnowledgeItems } from "@/features/knowledge-bank/server-store";
import { clearConversationSummary } from "@/features/chat/history-condenser";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  clearKnowledgeItems(conversationId);
  clearConversationSummary(conversationId);
  return NextResponse.json({ ok: true });
}