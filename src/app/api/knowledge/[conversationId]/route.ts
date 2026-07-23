import { NextRequest, NextResponse } from "next/server";
import { clearKnowledgeItems } from "@/features/knowledge-bank/server-store";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { conversationId: string } }) {
  clearKnowledgeItems(params.conversationId);
  return NextResponse.json({ ok: true });
}