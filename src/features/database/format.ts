import type { DatabaseSchemaSnapshot } from "./types";

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