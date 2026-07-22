"use client";

import * as React from "react";
import { Database, FileCode, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import type { KnowledgeItem } from "@/features/knowledge-bank/types";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rb",
  "php", "rs", "swift", "kt", "html", "css", "scss", "sql", "sh",
]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return CODE_EXTENSIONS.has(ext) ? FileCode : FileText;
}

interface KnowledgePanelProps {
  items: KnowledgeItem[];
  error: string | null;
  onAddFiles: (files: FileList) => void;
  onAddText: (name: string, content: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onDismissError: () => void;
  onClose?: () => void;
  onAddDatabaseSnapshot: () => void;
}

export function KnowledgePanel({
  items,
  error,
  onAddFiles,
  onAddText,
  onRemove,
  onToggle,
  onDismissError,
  onClose,
  onAddDatabaseSnapshot
}: KnowledgePanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [addingNote, setAddingNote] = React.useState(false);
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");

  const enabledCount = items.filter((i) => i.enabled).length;

  const submitNote = () => {
    if (!noteBody.trim()) return;
    onAddText(noteTitle, noteBody);
    setNoteTitle("");
    setNoteBody("");
    setAddingNote(false);
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-ink">Data bank</p>
        </div>
        {onClose && (
          <IconButton label="Close data bank" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <div className="px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload files
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddingNote((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Note
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddDatabaseSnapshot}>
            <Database className="h-3.5 w-100" /> Pull DB schema
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {enabledCount > 0
            ? `${enabledCount} item${enabledCount === 1 ? "" : "s"} will be sent as context with every message.`
            : "Add text, code, or notes here to give every message extra context."}
        </p>
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-500">
          <span>{error}</span>
          <button onClick={onDismissError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {addingNote && (
        <div className="mx-4 mb-3 space-y-2 rounded-xl border border-accent bg-surface p-3">
          <input
            autoFocus
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Paste text, code, or context here…"
            rows={5}
            className="rounded-lg border border-border px-2.5 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingNote(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitNote} disabled={!noteBody.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {items.length === 0 && !addingNote && (
          <p className="mt-6 text-center text-xs text-muted">Nothing in the data bank yet.</p>
        )}
        <ul className="space-y-1.5">
          {items.map((item) => {
            const Icon = iconFor(item.name);
            return (
              <li key={item.id} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 h-3.5 w-3.5 accent-accent"
                  aria-label={item.enabled ? `Exclude ${item.name} from context` : `Include ${item.name} as context`}
                />
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-muted">{formatSize(item.sizeBytes)}</p>
                </div>
                <IconButton label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}