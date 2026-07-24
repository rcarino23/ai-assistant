"use client";

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SIMPLE_TEXT_EXTENSIONS = ["txt", "md", "csv", "json", "xml"];
const RICH_DOCUMENT_EXTENSIONS = ["pdf", "docx", "xlsx"];

export function isExtractableFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return SIMPLE_TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/");
}

/** PDF, DOCX, XLSX — richer formats that need a parser, not a plain read. */
export function isRichDocumentFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return RICH_DOCUMENT_EXTENSIONS.includes(ext);
}

/** Images, video, and audio never get text-extracted — they're just attached. */
export function isPreviewableMedia(file: File): boolean {
  return (
    file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
  );
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(`--- Page ${i} ---\n${text}`);
  }
  return pages.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractXlsxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join("\n\n");
}

/** Dispatches to the right parser based on extension. Throws on failure — callers should catch. */
export async function extractDocumentText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return extractPdfText(file);
  if (ext === "docx") return extractDocxText(file);
  if (ext === "xlsx") return extractXlsxText(file);
  return readFileAsText(file);
}