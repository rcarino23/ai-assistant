"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  isStreaming: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function MessageInput({ isStreaming, disabled, disabledReason, onSend, onStop }: MessageInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  React.useEffect(resize, [value]);

  const submit = () => {
    if (!value.trim() || isStreaming || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {disabled && disabledReason && (
        <p className="mb-2 text-center text-xs text-muted">{disabledReason}</p>
      )}
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-soft transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]"
        )}
      >
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
            disabled={!value.trim() || disabled}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Press Enter to send, Shift + Enter for a new line.
      </p>
    </div>
  );
}
