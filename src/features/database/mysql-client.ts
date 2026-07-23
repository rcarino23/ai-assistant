import mysql from "mysql2/promise";
import type { DatabaseSchemaSnapshot, QueryResult, TableSchema } from "./types";
import { schemaSnapshotToText } from "./format";

const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 10_000;

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

function getPool(): mysql.Pool {
  if (!isDatabaseConfigured()) {
    throw new Error("MySQL is not configured. Add MYSQL_HOST/USER/PASSWORD/DATABASE to .env.local.");
  }
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectionLimit: 5,
      connectTimeout: QUERY_TIMEOUT_MS,
    });
  }
  return pool;
}

/**
 * Rejects anything that isn't a single, harmless read query. This is a
 * defense-in-depth check, NOT a substitute for a read-only DB user —
 * always pair this with a MySQL account that only has SELECT granted.
 */
export function assertReadOnlyQuery(sql: string): void {
  const trimmed = sql.trim().replace(/;+\s*$/, "");

  if (trimmed.includes(";")) {
    throw new Error("Multiple statements are not allowed.");
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "SHOW" && firstWord !== "DESCRIBE" && firstWord !== "EXPLAIN") {
    throw new Error("Only SELECT/SHOW/DESCRIBE/EXPLAIN statements are permitted.");
  }

  const forbidden = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE",
    "GRANT", "REVOKE", "REPLACE", "LOAD_FILE", "INTO OUTFILE", "INTO DUMPFILE",
  ];
  const upper = trimmed.toUpperCase();
  for (const word of forbidden) {
    if (upper.includes(word)) {
      throw new Error(`Query contains a forbidden keyword: ${word}`);
    }
  }
}

export async function runReadOnlyQuery(sql: string): Promise<QueryResult> {
  assertReadOnlyQuery(sql);

  const db = getPool();
  const guardedSql = /\blimit\b/i.test(sql) ? sql : `${sql.trim().replace(/;+\s*$/, "")} LIMIT ${MAX_ROWS}`;

  const [rows] = await db.query({ sql: guardedSql, timeout: QUERY_TIMEOUT_MS });
  const rowArray = rows as Record<string, unknown>[];
  const columns = rowArray.length > 0 ? Object.keys(rowArray[0]) : [];

  return {
    columns,
    rows: rowArray.slice(0, MAX_ROWS),
    rowCount: rowArray.length,
    truncated: rowArray.length >= MAX_ROWS,
  };
}

export async function getSchemaSnapshot(sampleRowsPerTable = 3): Promise<DatabaseSchemaSnapshot> {
  const db = getPool();
  const database = process.env.MYSQL_DATABASE as string;

  const [tableRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [database]
  );

  const tables: TableSchema[] = [];

  for (const row of tableRows) {
    const tableName = row.TABLE_NAME as string;

    const [columnRows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, tableName]
    );

    const columns = columnRows.map((c) => ({
      name: c.COLUMN_NAME as string,
      type: c.COLUMN_TYPE as string,
      nullable: c.IS_NULLABLE === "YES",
      key: c.COLUMN_KEY as string,
    }));

    let sampleRows: Record<string, unknown>[] | undefined;
    if (sampleRowsPerTable > 0) {
      try {
        // Table names can't be parameterized — safe here because tableName
        // came from information_schema, not user input.
        const [sample] = await db.query(
          `SELECT * FROM \`${tableName}\` LIMIT ${sampleRowsPerTable}`
        );
        sampleRows = sample as Record<string, unknown>[];
      } catch {
        sampleRows = undefined;
      }
    }

    tables.push({ name: tableName, columns, sampleRows });
  }

  return { database, tables, generatedAt: Date.now() };
}

export { schemaSnapshotToText };