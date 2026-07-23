"use client";

import * as React from "react";
import { Check, Copy, Loader2, Pencil, RotateCcw, Sparkles, User, X } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn, formatTime } from "@/lib/utils";
import { Markdown } from "./markdown";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SentAttachments } from "./sent-attachments";

interface MessageItemProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  onEdit: (id: string, content: string) => void;
  onRetry: (id: string) => void;
  onRegenerate: () => void;
}

export function MessageItem({ message, isLastAssistant, onEdit, onRetry, onRegenerate }: MessageItemProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.content);
  const [copied, setCopied] = React.useState(false);

  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveEdit = () => {
    if (draft.trim() && draft !== message.content) {
      onEdit(message.id, draft.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group flex w-full animate-fade-in gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}

      <div className={cn("flex max-w-[75ch] flex-col", isUser && "items-end")}>
        {editing ? (
          <div className="w-full min-w-[280px] rounded-2xl border border-accent bg-surface p-3 shadow-soft">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(8, draft.split("\n").length + 1)}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdit}>
                <Check className="h-3.5 w-3.5" /> Save & submit
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 shadow-soft",
              isUser ? "bg-accent text-accent-ink" : "bg-surface border border-border"
            )}
          >
            {!isUser && message.activity && message.activity.length > 0 && (
              <div className="mb-1.5 space-y-1">
                {message.activity.map((step) => (
                  <div key={step.id} className="flex items-center gap-1.5 text-xs text-muted">
                    {step.status === "active" ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 shrink-0" />
                    )}
                    <span className={cn(step.status === "active" && "animate-pulse")}>{step.label}</span>
                  </div>
                ))}
              </div>
            )}
            {isUser ? (
              <>
                {message.attachments && message.attachments.length > 0 && (
                  <SentAttachments attachments={message.attachments} />
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
                )}
              </>
            ) : message.content ? (
              <Markdown content={message.content} />
            ) : message.status === "streaming" ? (
              <span className="inline-block h-4 w-1.5 animate-blink rounded-sm bg-muted" />
            ) : (
              <span className="text-sm text-muted">No response.</span>
            )}

            {message.status === "stopped" && (
              <p className="mt-1 text-xs text-muted">Generation stopped.</p>
            )}
            {message.status === "error" && (
              <p className="mt-1 text-xs text-red-500">Something went wrong generating this reply.</p>
            )}
          </div>
        )}

        <div
          className={cn(
            "mt-1 flex items-center gap-1 px-1 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100",
            isUser && "flex-row-reverse"
          )}
        >
          <span>{formatTime(message.createdAt)}</span>

          {!editing && isUser && (
            <IconButton label="Edit message" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </IconButton>
          )}

          {!editing && isUser && (
            <IconButton label="Retry from here" onClick={() => onRetry(message.id)}>
              <RotateCcw className="h-3 w-3" />
            </IconButton>
          )}

          {!isUser && message.status !== "streaming" && (
            <IconButton label="Copy response" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </IconButton>
          )}

          {!isUser && isLastAssistant && message.status !== "streaming" && (
            <IconButton label="Regenerate response" onClick={onRegenerate}>
              <RotateCcw className="h-3 w-3" />
            </IconButton>
          )}
        </div>
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
