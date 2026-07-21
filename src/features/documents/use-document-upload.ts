"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { UploadedDocument, DocumentType } from "./types";
import { isExtractableFile, isPreviewableMedia, readFileAsText } from "./extract-text";

const MAX_FILES = 5;
const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024; // 5MB — read fully into the prompt as text
const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024; // 15MB — local preview only, never read into memory as text
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024; // 100MB — local preview only

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

function maxSizeFor(file: File): number {
  if (file.type.startsWith("video/")) return MAX_VIDEO_FILE_SIZE;
  if (file.type.startsWith("image/") || file.type.startsWith("audio/")) return MAX_IMAGE_FILE_SIZE;
  return MAX_TEXT_FILE_SIZE;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
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
          setDocuments((prev) => [...prev, { ...doc, previewUrl, selectedAsContext: false }]);
          continue;
        }

        // Plain text-ish files: read into the prompt as context.
        if (isExtractableFile(file)) {
          try {
            const text = await readFileAsText(file);
            setDocuments((prev) => [...prev, { ...doc, extractedText: text }]);
          } catch {
            setError(`Couldn't read "${file.name}".`);
            setDocuments((prev) => [...prev, doc]);
          }
          continue;
        }

        // Everything else (pdf, docx, xlsx, unknown types, etc.): attach it.
        // No in-browser text extraction for these yet, but that's fine —
        // it just won't be added as text context.
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