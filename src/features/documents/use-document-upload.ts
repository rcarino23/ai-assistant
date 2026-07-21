"use client";

import { useCallback, useState } from "react";
import { v4 as uuid } from "uuid";
import type { UploadedDocument, DocumentType } from "./types";
import { isExtractableFile, readFileAsText } from "./extract-text";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — keeps prompt payloads sane
const MAX_FILES = 5;

function inferType(file: File): DocumentType {
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "pdf";
    case "docx": return "docx";
    case "csv": return "csv";
    case "xlsx": return "xlsx";
    case "json": return "json";
    case "xml": return "xml";
    case "md": return "md";
    default: return "txt";
  }
}

export function useDocumentUpload() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);

      if (documents.length + list.length > MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files per message.`);
        return;
      }

      for (const file of list) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`"${file.name}" is larger than 5MB and was skipped.`);
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

        if (!isExtractableFile(file)) {
          setError(
            `"${file.name}" isn't readable in-browser yet — only .txt, .md, .csv, .json, and .xml are supported until a server-side extraction route is added for PDF/DOCX.`
          );
          setDocuments((prev) => [...prev, doc]);
          continue;
        }

        try {
          const text = await readFileAsText(file);
          setDocuments((prev) => [...prev, { ...doc, extractedText: text }]);
        } catch {
          setError(`Couldn't read "${file.name}".`);
          setDocuments((prev) => [...prev, doc]);
        }
      }
    },
    [documents.length]
  );

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clear = useCallback(() => setDocuments([]), []);

  return { documents, addFiles, removeDocument, clear, error, setError };
}