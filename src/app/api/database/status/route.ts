import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/features/database/mysql-client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: isDatabaseConfigured() });
}