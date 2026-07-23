import { NextRequest, NextResponse } from "next/server";
import { getSchemaSnapshot, getTableRows, queryResultToCsv } from "@/features/database/registry";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "Format must be 'json' or 'csv'." }, { status: 400 });
  }

  try {
    // sampleRowsPerTable=0 — we only need table names here, not preview rows.
    const snapshot = await getSchemaSnapshot(0);
    const sections: string[] = [];
    let truncatedAny = false;

    for (const table of snapshot.tables) {
      try {
        const result = await getTableRows(table.name);
        if (result.truncated) truncatedAny = true;
        const body = format === "csv" ? queryResultToCsv(result) : JSON.stringify(result.rows, null, 2);
        const meta = `${result.rowCount} row${result.rowCount === 1 ? "" : "s"}${result.truncated ? ", truncated" : ""}`;
        sections.push(`### ${table.name} (${meta})\n${body}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch table data";
        sections.push(`### ${table.name}\nError: ${message}`);
      }
    }

    return NextResponse.json({
      text: sections.join("\n\n"),
      tableCount: snapshot.tables.length,
      truncated: truncatedAny,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch table data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}