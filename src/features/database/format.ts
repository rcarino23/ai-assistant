import type { DatabaseSchemaSnapshot, QueryResult } from "./types";

export function schemaSnapshotToText(snapshot: DatabaseSchemaSnapshot): string {
  const lines: string[] = [`Database: ${snapshot.database}`, ""];

  for (const table of snapshot.tables) {
    lines.push(`## ${table.name}`);
    lines.push(
      table.columns
        .map((c) => `- ${c.name}: ${c.type}${c.key === "PRI" ? " (primary key)" : ""}${c.nullable ? "" : " NOT NULL"}`)
        .join("\n")
    );
    if (table.sampleRows && table.sampleRows.length > 0) {
      lines.push(`\nSample rows:\n${JSON.stringify(table.sampleRows, null, 2)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Renders a QueryResult as RFC 4180-ish CSV text (quotes fields containing commas/quotes/newlines). */
export function queryResultToCsv(result: QueryResult): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = result.columns.map(escape).join(",");
  const rows = result.rows.map((row) => result.columns.map((c) => escape(row[c])).join(","));
  return [header, ...rows].join("\n");
}