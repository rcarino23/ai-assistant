"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { UploadedDocument, DocumentType } from "./types";
import { isExtractableFile, isPreviewableMedia, isRichDocumentFile, extractDocumentText, readFileAsText } from "./extract-text";

const MAX_FILES = 5;
const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024;        // 5MB — read fully into the prompt as text
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024;      // 15MB — local preview only
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;     // 100MB — local preview only
const MAX_ATTACH_ONLY_FILE_SIZE = 25 * 1024 * 1024; // 25MB — attached but not parsed (pdf, docx, xlsx, other)
const MAX_RICH_DOC_FILE_SIZE = 20 * 1024 * 1024

function inferType(file: File): DocumentType {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  switch (ext) {
    case "pdf": return "pdf";
    case "docx": return "docx";
    case "csv": return "csv";
    case "xlsx": return "xlsx";
    case "json": return "json";
    case "xml": return "xml";
    case "md": return "md";
    case "txt": return "txt";
    default: return "other";
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function maxSizeFor(file: File): number {
  if (file.type.startsWith("video/")) return MAX_VIDEO_FILE_SIZE;
  if (file.type.startsWith("image/") || file.type.startsWith("audio/")) return MAX_IMAGE_FILE_SIZE;
  if (isRichDocumentFile(file)) return MAX_RICH_DOC_FILE_SIZE;
  if (isExtractableFile(file)) return MAX_TEXT_FILE_SIZE;
  return MAX_ATTACH_ONLY_FILE_SIZE;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

const MAX_EXTRACTED_TEXT_CHARS = 120_000; // stays safely under context limits even on long chats

function truncateExtractedText(text: string, fileName: string): string {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return text;
  return (
    text.slice(0, MAX_EXTRACTED_TEXT_CHARS) +
    `\n\n[...truncated — "${fileName}" was ${text.length.toLocaleString()} characters; ` +
    `only the first ${MAX_EXTRACTED_TEXT_CHARS.toLocaleString()} were kept.]`
  );
}

export function useDocumentUpload() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previewUrls = useRef<Set<string>>(new Set());

  // Revoke any object URLs we created so we don't leak memory.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);

      if (documents.length + list.length > MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files per message.`);
        return;
      }

      for (const file of list) {
        const limit = maxSizeFor(file);
        if (file.size > limit) {
          setError(`"${file.name}" is larger than ${formatSize(limit)} and was skipped.`);
          continue;
        }

        const doc: UploadedDocument = {
          id: uuid(),
          name: file.name,
          type: inferType(file),
          sizeBytes: file.size,
          extractedText: "",
          uploadedAt: Date.now(),
          selectedAsContext: true,
        };

        // Images / video / audio: no text extraction — just attach with a
        // local preview. This is expected, not an error.
        if (isPreviewableMedia(file)) {
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.add(previewUrl);

          if (file.type.startsWith("image/")) {
            // Images: also read the actual bytes so they can be sent to the model.
            try {
              const base64Data = await readFileAsBase64(file);
              const newDoc = { ...doc, previewUrl, base64Data, mediaType: file.type, selectedAsContext: true };
              setDocuments((prev) => [...prev, newDoc]);
            } catch {
              setError(`Couldn't read "${file.name}".`);
              setDocuments((prev) => [...prev, { ...doc, previewUrl, selectedAsContext: false }]);
            }
          } else {
            // video/audio: preview only, no model support yet
            setDocuments((prev) => [...prev, { ...doc, previewUrl, selectedAsContext: false }]);
          }
          continue;
        }

        // PDF / DOCX / XLSX: parse and read into the prompt as context, same as plain text files.
        if (isRichDocumentFile(file)) {
          try {
            const text = truncateExtractedText(await extractDocumentText(file), file.name);
            setDocuments((prev) => [...prev, { ...doc, extractedText: text }]);
          } catch {
            setError(`Couldn't read "${file.name}" — it was attached but its contents won't be sent to the model.`);
            setDocuments((prev) => [...prev, doc]);
          }
          continue;
        }

        // Plain text-ish files: read into the prompt as context.
        if (isExtractableFile(file)) {
          try {
            const text = truncateExtractedText(await readFileAsText(file), file.name);
            setDocuments((prev) => [...prev, { ...doc, extractedText: text }]);
          } catch {
            setError(`Couldn't read "${file.name}".`);
            setDocuments((prev) => [...prev, doc]);
          }
          continue;
        }

        // Everything else (pdf, docx, xlsx, unknown types, etc.): attach it.
        setDocuments((prev) => [...prev, doc]);
      }
    },
    [documents.length]
  );
  

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc?.previewUrl) {
        URL.revokeObjectURL(doc.previewUrl);
        previewUrls.current.delete(doc.previewUrl);
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setDocuments((prev) => {
      prev.forEach((d) => {
        if (d.previewUrl) {
          URL.revokeObjectURL(d.previewUrl);
          previewUrls.current.delete(d.previewUrl);
        }
      });
      return [];
    });
  }, []);

  const reset = useCallback(() => {
    setDocuments((prev) => {
      prev.forEach((d) => {
        if (d.previewUrl) previewUrls.current.delete(d.previewUrl);
      });
      return [];
    });
  }, []);

  return { documents, addFiles, removeDocument, clear, reset, error, setError };
}