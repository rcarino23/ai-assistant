import { NextRequest, NextResponse } from "next/server";
import { deleteStoredDocument, getStoredDocument } from "@/lib/services/document-pipeline";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const document = getStoredDocument(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, document });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  deleteStoredDocument(documentId);
  return NextResponse.json({ ok: true });
}
