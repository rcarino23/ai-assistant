"use client";

import { FileAudio, FileText, FileVideo } from "lucide-react";
import type { UploadedDocument } from "@/features/documents/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(type: UploadedDocument["type"]) {
  switch (type) {
    case "video": return FileVideo;
    case "audio": return FileAudio;
    default: return FileText;
  }
}

interface SentAttachmentsProps {
  attachments: UploadedDocument[];
}

export function SentAttachments({ attachments }: SentAttachmentsProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.type === "image" && a.previewUrl);
  const others = attachments.filter((a) => !(a.type === "image" && a.previewUrl));

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.id}
          src={img.previewUrl}
          alt={img.name}
          className="h-28 w-28 rounded-xl border border-white/20 object-cover"
        />
      ))}
      {others.map((doc) => {
        const Icon = iconFor(doc.type);
        return (
          <div
            key={doc.id}
            className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate font-medium">{doc.name}</span>
            <span className="opacity-80">{formatSize(doc.sizeBytes)}</span>
          </div>
        );
      })}
    </div>
  );
}