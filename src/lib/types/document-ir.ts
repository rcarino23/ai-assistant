export type SourceFormat = "pdf" | "xlsx" | "xls" | "docx" | "csv" | "txt" | "md" | "json";

/** Top-level structural unit shared by every format. */
export interface DocumentSection {
  id: string;                 // stable id within the document, e.g. "p4-h2" or "sheet:Payroll:rows:1-50"
  kind: "heading" | "paragraph" | "table" | "list" | "sheet" | "row-group" | "code" | "raw";
  level?: number;              // heading level (1-6) or nesting depth
  page?: number;                // PDF page number, 1-indexed
  sheet?: string;                // Excel sheet name
  text: string;                  // human-readable text for this section (for chunking/embedding)
  table?: TableBlock;             // structured table data, if kind === "table"
  children?: DocumentSection[];    // nested sections (e.g. paragraphs under a heading)
}

export interface TableBlock {
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  /** Raw formula strings, keyed "A1" style, only populated when requested. */
  formulas?: Record<string, string>;
  mergedRanges?: string[];       // e.g. ["A1:B1"]
}

export interface ParsedDocument {
  documentId: string;
  format: SourceFormat;
  sections: DocumentSection[];
  /** Format-specific facts useful for metadata inference, e.g. { sheetNames, pageCount }. */
  raw: {
    pageCount?: number;
    sheetNames?: string[];
  };
}