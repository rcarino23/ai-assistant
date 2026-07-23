// src/app/api/providers/route.ts
import { NextResponse } from "next/server";
import { getProviderSummaries } from "@/features/providers/registry";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ providers: await getProviderSummaries() });
}