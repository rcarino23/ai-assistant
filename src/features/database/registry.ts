import * as mysqlClient from "./mysql-client";
import * as mssqlClient from "./mssql-client";
import { schemaSnapshotToText as formatSnapshot, queryResultToCsv } from "./format";
import type { DatabaseSchemaSnapshot, QueryResult } from "./types";

export type DatabaseEngine = "mysql" | "mssql";

function detectEngine(): DatabaseEngine | null {
  const forced = (process.env.DB_ENGINE || "").trim().toLowerCase();
  if (forced === "mysql" || forced === "mssql") return forced;
  if (mssqlClient.isDatabaseConfigured()) return "mssql";
  if (mysqlClient.isDatabaseConfigured()) return "mysql";
  return null;
}

export function isDatabaseConfigured(): boolean {
  return detectEngine() !== null;
}

export function getEngineLabel(): string {
  const engine = detectEngine();
  if (engine === "mssql") return "SQL Server";
  if (engine === "mysql") return "MySQL";
  return "None";
}

export async function runReadOnlyQuery(sql: string): Promise<QueryResult> {
  const engine = detectEngine();
  if (engine === "mssql") return mssqlClient.runReadOnlyQuery(sql);
  if (engine === "mysql") return mysqlClient.runReadOnlyQuery(sql);
  throw new Error("No database is configured. Add MySQL or SQL Server credentials to .env.local.");
}

export async function getSchemaSnapshot(sampleRowsPerTable = 3): Promise<DatabaseSchemaSnapshot> {
  const engine = detectEngine();
  if (engine === "mssql") return mssqlClient.getSchemaSnapshot(sampleRowsPerTable);
  if (engine === "mysql") return mysqlClient.getSchemaSnapshot(sampleRowsPerTable);
  throw new Error("No database is configured. Add MySQL or SQL Server credentials to .env.local.");
}

/**
 * Table names coming from the schema list may be schema-qualified
 * ("Transactions.Payrolls" on SQL Server, where the DB has many tables
 * outside dbo). Split on the LAST dot so a MySQL database name containing
 * a dot (rare, but possible) doesn't break this.
 */
function splitQualifiedTableName(qualified: string): { schema: string | null; table: string } {
  const idx = qualified.lastIndexOf(".");
  if (idx === -1) return { schema: null, table: qualified };
  return { schema: qualified.slice(0, idx), table: qualified.slice(idx + 1) };
}

/**
 * Full-table pull, used by the "Table data" mode in the data bank.
 * `table` must already be validated by the caller (see the table-data API
 * route's regex check) — this only adds engine-appropriate identifier
 * quoting, it isn't itself a sanitizer.
 */
export async function getTableRows(table: string): Promise<QueryResult> {
  const engine = detectEngine();
  const { schema, table: tableName } = splitQualifiedTableName(table);

  if (engine === "mssql") {
    // Tables outside dbo (e.g. Transactions.Payrolls) MUST be schema-qualified
    // or SQL Server throws "Invalid object name" — dbo is just the fallback
    // for schema-less names.
    const qualified = schema ? `[${schema}].[${tableName}]` : `[dbo].[${tableName}]`;
    return mssqlClient.runReadOnlyQuery(`SELECT * FROM ${qualified}`);
  }
  if (engine === "mysql") {
    const qualified = schema ? `\`${schema}\`.\`${tableName}\`` : `\`${tableName}\``;
    return mysqlClient.runReadOnlyQuery(`SELECT * FROM ${qualified}`);
  }
  throw new Error("No database is configured. Add MySQL or SQL Server credentials to .env.local.");
}

export const schemaSnapshotToText = formatSnapshot;
export { queryResultToCsv };