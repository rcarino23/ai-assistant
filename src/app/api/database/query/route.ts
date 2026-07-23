import { NextRequest, NextResponse } from "next/server";
import { runReadOnlyQuery } from "@/features/database/registry";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { sql } = (await req.json()) as { sql: string };
  try {
    const result = await runReadOnlyQuery(sql);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}