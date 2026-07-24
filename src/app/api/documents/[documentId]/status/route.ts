import { NextRequest, NextResponse } from "next/server";
import { getStoredDocument } from "@/lib/services/document-pipeline";

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

  return NextResponse.json({
    ok: true,
    document: {
      id: document.id,
      filename: document.filename,
      status: document.status,
      format: document.format,
      sizeBytes: document.sizeBytes,
      updatedAt: document.updatedAt,
      textSnippet: document.text.slice(0, 300),
    },
  });
}
