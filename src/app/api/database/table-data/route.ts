import { NextRequest, NextResponse } from "next/server";
import { getTableRows, queryResultToCsv } from "@/features/database/registry";

export const runtime = "nodejs";

// Table names come from the schema dropdown and may be schema-qualified
// (e.g. "Transactions.Payrolls") — allow one optional ".segment", still
// validated before interpolating into SQL.
const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") ?? "";
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  if (!VALID_TABLE_NAME.test(table)) {
    return NextResponse.json({ error: "Invalid or missing table name." }, { status: 400 });
  }
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "Format must be 'json' or 'csv'." }, { status: 400 });
  }

  try {
    const result = await getTableRows(table);
    const text = format === "csv" ? queryResultToCsv(result) : JSON.stringify(result.rows, null, 2);
    return NextResponse.json({ text, rowCount: result.rowCount, truncated: result.truncated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch table data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}