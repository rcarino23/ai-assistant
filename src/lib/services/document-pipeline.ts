import { v4 as uuid } from "uuid";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { SourceFormat } from "@/lib/types/document-ir";

export type DocumentQueueStatus = "queued" | "parsing" | "chunking" | "embedding" | "ready" | "failed";

export interface StoredDocumentRecord {
  id: string;
  conversationId: string;
  ownerId: string;
  filename: string;
  format: SourceFormat;
  storageUrl: string;
  sizeBytes: number;
  status: DocumentQueueStatus;
  error?: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

const documentStore = new Map<string, StoredDocumentRecord>();

function inferFormat(file: File): SourceFormat {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "xlsx" || extension === "xls") return "xlsx";
  if (extension === "csv") return "csv";
  if (extension === "json") return "json";
  if (extension === "md") return "md";
  if (extension === "txt") return "txt";
  return "txt";
}

async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "docx") {
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }

  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  if (extension === "json") {
    const parsed = JSON.parse(await file.text());
    return JSON.stringify(parsed, null, 2);
  }

  return await file.text();
}

export async function enqueueDocumentUpload(input: {
  conversationId: string;
  ownerId: string;
  file: File;
}): Promise<StoredDocumentRecord> {
  const id = uuid();
  const format = inferFormat(input.file);
  const text = await extractTextFromFile(input.file);
  const now = Date.now();

  const record: StoredDocumentRecord = {
    id,
    conversationId: input.conversationId,
    ownerId: input.ownerId,
    filename: input.file.name,
    format,
    storageUrl: `memory://${input.file.name}`,
    sizeBytes: input.file.size,
    status: "ready",
    text,
    createdAt: now,
    updatedAt: now,
  };

  documentStore.set(record.id, record);
  return record;
}

export function getStoredDocument(documentId: string): StoredDocumentRecord | undefined {
  return documentStore.get(documentId);
}

export function deleteStoredDocument(documentId: string) {
  documentStore.delete(documentId);
}

export function listStoredDocumentsForConversation(conversationId: string): StoredDocumentRecord[] {
  return Array.from(documentStore.values()).filter((record) => record.conversationId === conversationId);
}
