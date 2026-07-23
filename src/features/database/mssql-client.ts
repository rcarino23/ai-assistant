import sql from "mssql";
import type { DatabaseSchemaSnapshot, QueryResult, TableSchema } from "./types";

const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 10_000;

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

/**
 * Supports two ways to configure the connection:
 *  - MSSQL_CONNECTION_STRING: a full ADO/mssql-style connection string
 *  - Discrete fields: MSSQL_SERVER + MSSQL_USER + MSSQL_PASSWORD + MSSQL_DATABASE
 *    (SQL Server authentication, not Windows/AD auth)
 */
export function isDatabaseConfigured(): boolean {
  if (process.env.MSSQL_CONNECTION_STRING) return true;
  return Boolean(process.env.MSSQL_SERVER && process.env.MSSQL_USER && process.env.MSSQL_DATABASE);
}

function buildConfig(): string | sql.config {
  if (process.env.MSSQL_CONNECTION_STRING) {
    return process.env.MSSQL_CONNECTION_STRING;
  }
  return {
    server: process.env.MSSQL_SERVER as string,
    port: Number(process.env.MSSQL_PORT) || 1433,
    database: process.env.MSSQL_DATABASE,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    connectionTimeout: QUERY_TIMEOUT_MS,
    requestTimeout: QUERY_TIMEOUT_MS,
    options: {
      // Azure SQL requires encryption; on-prem instances with self-signed
      // certs may need MSSQL_TRUST_SERVER_CERTIFICATE=true.
      encrypt: (process.env.MSSQL_ENCRYPT ?? "true").toLowerCase() !== "false",
      trustServerCertificate: (process.env.MSSQL_TRUST_SERVER_CERTIFICATE ?? "false").toLowerCase() === "true",
    },
  };
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (!isDatabaseConfigured()) {
    throw new Error(
      "SQL Server is not configured. Add MSSQL_CONNECTION_STRING, or MSSQL_SERVER/MSSQL_USER/MSSQL_PASSWORD/MSSQL_DATABASE, to .env.local."
    );
  }
  if (pool?.connected) return pool;
  if (!connecting) {
    connecting = sql.connect(buildConfig());
  }
  pool = await connecting;
  connecting = null;
  return pool;
}

/**
 * Defense-in-depth check, NOT a substitute for a read-only DB login —
 * always pair this with a SQL Server login that only has SELECT granted.
 */
export function assertReadOnlyQuery(queryText: string): void {
  const trimmed = queryText.trim().replace(/;+\s*$/, "");

  if (trimmed.includes(";")) {
    throw new Error("Multiple statements are not allowed.");
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    throw new Error("Only SELECT statements (optionally starting with a WITH CTE) are permitted.");
  }

  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "MERGE", "EXEC", "EXECUTE"];
  const upper = trimmed.toUpperCase();
  for (const word of forbidden) {
    if (upper.includes(word)) {
      throw new Error(`Query contains a forbidden keyword: ${word}`);
    }
  }

  if (/\bSELECT\b[\s\S]*\bINTO\b\s+\S+\s+FROM\b/i.test(trimmed)) {
    throw new Error("SELECT INTO is not allowed.");
  }
}

function guardedQuery(queryText: string, maxRows: number): string {
  const trimmed = queryText.trim().replace(/;+\s*$/, "");
  // CTEs can't be wrapped as a derived table, so trust the request timeout as the safety net there.
  if (/^\s*WITH\b/i.test(trimmed)) return trimmed;
  if (/^\s*SELECT\s+(DISTINCT\s+)?TOP\s+\d+/i.test(trimmed)) return trimmed;
  return `SELECT TOP ${maxRows} * FROM (${trimmed}) AS limited_result`;
}

export async function runReadOnlyQuery(queryText: string): Promise<QueryResult> {
  assertReadOnlyQuery(queryText);

  const connectedPool = await getPool();
  const request = connectedPool.request();

  const result = await request.query(guardedQuery(queryText, MAX_ROWS));
  const rowArray = (result.recordset ?? []) as Record<string, unknown>[];
  const columns = rowArray.length > 0 ? Object.keys(rowArray[0]) : [];

  return {
    columns,
    rows: rowArray.slice(0, MAX_ROWS),
    rowCount: rowArray.length,
    truncated: rowArray.length >= MAX_ROWS,
  };
}

export async function getSchemaSnapshot(sampleRowsPerTable = 3): Promise<DatabaseSchemaSnapshot> {
  const connectedPool = await getPool();
  const database = process.env.MSSQL_DATABASE || "";

  const tableRows = await connectedPool
    .request()
    .query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`
    );

  const tables: TableSchema[] = [];

  for (const row of tableRows.recordset) {
    const rawSchema = row.TABLE_SCHEMA;
    const rawTable = row.TABLE_NAME;
    // Schema-qualify the display/storage name (e.g. "Transactions.Payrolls")
    // so downstream table-data pulls know which schema to query — this DB
    // has many tables that only exist under a non-dbo schema.
    const qualifiedName = `${rawSchema}.${rawTable}`;

    const columnRows = await connectedPool
      .request()
      .input("tableName", sql.NVarChar, rawTable)
      .input("tableSchema", sql.NVarChar, rawSchema)
      .query(`
        SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA AND pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_NAME = @tableName AND c.TABLE_SCHEMA = @tableSchema
        ORDER BY c.ORDINAL_POSITION
      `);

    const columns = columnRows.recordset.map((c) => ({
      name: c.COLUMN_NAME as string,
      type: c.DATA_TYPE as string,
      nullable: c.IS_NULLABLE === "YES",
      key: (c.COLUMN_KEY as string) || "",
    }));

    let sampleRows: Record<string, unknown>[] | undefined;
    if (sampleRowsPerTable > 0) {
      try {
        // Both parts came from INFORMATION_SCHEMA, not user input — safe to interpolate.
        const sample = await connectedPool
          .request()
          .query(`SELECT TOP ${sampleRowsPerTable} * FROM [${rawSchema}].[${rawTable}]`);
        sampleRows = sample.recordset as Record<string, unknown>[];
      } catch {
        sampleRows = undefined;
      }
    }

    tables.push({ name: qualifiedName, columns, sampleRows });
  }

  return { database, tables, generatedAt: Date.now() };
}