"use client";

import * as React from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useDocumentUpload } from "@/features/documents/use-document-upload";
import type { UploadedDocument } from "@/features/documents/types";
import { AttachmentChip } from "./attachment-chip";
import { PromptMenu } from "./prompt-menu";

interface MessageInputProps {
  isStreaming: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSend: (content: string, documents: UploadedDocument[]) => void;
  onStop: () => void;
}

export function MessageInput({ isStreaming, disabled, disabledReason, onSend, onStop }: MessageInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { documents, addFiles, removeDocument, clear, error, setError } = useDocumentUpload();

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  React.useEffect(resize, [value]);

  const submit = () => {
    if ((!value.trim() && documents.length === 0) || isStreaming || disabled) return;
    onSend(value.trim(), documents);
    setValue("");
    clear();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePromptSelect = (template: string) => {
    setValue((current) => (current ? template.replace("{{text}}", current) : template));
    textareaRef.current?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {disabled && disabledReason && (
        <p className="mb-2 text-center text-xs text-muted">{disabledReason}</p>
      )}

      {error && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-500">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {documents.map((doc) => (
            <AttachmentChip key={doc.id} document={doc} onRemove={removeDocument} />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-soft transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <IconButton label="Attach files" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
          <Paperclip className="h-4 w-4" />
        </IconButton>

        <PromptMenu onSelect={handlePromptSelect} />

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the assistant…"
          rows={1}
          disabled={disabled}
          className="max-h-[200px] flex-1 px-2 py-1.5"
        />
        {isStreaming ? (
          <Button size="icon" variant="outline" onClick={onStop} aria-label="Stop generating">
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={submit}
            disabled={(!value.trim() && documents.length === 0) || disabled}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Press Enter to send, Shift + Enter for a new line. Text files (.txt, .md, .csv, .json, .xml) are read
        as context; images, video, and other files are attached but not read as text yet.
      </p>
    </div>
  );
}