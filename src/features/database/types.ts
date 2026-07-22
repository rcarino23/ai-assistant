export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  key: string; // "PRI", "UNI", "MUL", or ""
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  sampleRows?: Record<string, unknown>[];
}

export interface DatabaseSchemaSnapshot {
  database: string;
  tables: TableSchema[];
  generatedAt: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}