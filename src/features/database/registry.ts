import * as mysqlClient from "./mysql-client";
import * as mssqlClient from "./mssql-client";
import { schemaSnapshotToText as formatSnapshot } from "./format";
import type { DatabaseSchemaSnapshot, QueryResult } from "./types";

export type DatabaseEngine = "mysql" | "mssql";

/** DB_ENGINE lets you force a choice if both happen to be configured; otherwise auto-detect. */
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

export const schemaSnapshotToText = formatSnapshot;