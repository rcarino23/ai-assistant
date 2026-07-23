import { NextResponse } from "next/server";
import { isDatabaseConfigured, getEngineLabel, runReadOnlyQuery } from "@/features/database/registry";

export const runtime = "nodejs";

export async function GET() {
  const configured = isDatabaseConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false, engine: "None" });
  }

  try {
    await runReadOnlyQuery("SELECT 1 AS ok");
    return NextResponse.json({ configured: true, connected: true, engine: getEngineLabel() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ configured: true, connected: false, engine: getEngineLabel(), error: message });
  }
}