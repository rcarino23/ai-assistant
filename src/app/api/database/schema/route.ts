import { NextResponse } from "next/server";
import { getSchemaSnapshot, schemaSnapshotToText } from "@/features/database/registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getSchemaSnapshot();
    return NextResponse.json({ text: schemaSnapshotToText(snapshot), snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read schema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}