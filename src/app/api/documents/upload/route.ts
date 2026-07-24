import { NextRequest, NextResponse } from "next/server";
import { enqueueDocumentUpload } from "@/lib/services/document-pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const conversationId = String(formData.get("conversationId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? (conversationId || "anonymous"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing uploaded file." }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId." }, { status: 400 });
  }

  const record = await enqueueDocumentUpload({ conversationId, ownerId, file });

  return NextResponse.json({
    ok: true,
    document: {
      id: record.id,
      filename: record.filename,
      format: record.format,
      status: record.status,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
    },
  });
}
