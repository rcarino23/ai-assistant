"use client";

import { FileText, X, Loader2 } from "lucide-react";
import type { UploadedDocument } from "@/features/documents/types";
import { IconButton } from "@/components/ui/icon-button";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentChipProps {
  document: UploadedDocument;
  onRemove: (id: string) => void;
}

export function AttachmentChip({ document, onRemove }: AttachmentChipProps) {
  const extracted = document.extractedText.length > 0;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs">
      <FileText className="h-3.5 w-3.5 text-muted" />
      <span className="max-w-[140px] truncate font-medium text-ink">{document.name}</span>
      <span className="text-muted">{formatSize(document.sizeBytes)}</span>
      {!extracted && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
      <IconButton label={`Remove ${document.name}`} className="h-4 w-4" onClick={() => onRemove(document.id)}>
        <X className="h-3 w-3" />
      </IconButton>
    </div>
  );
}