"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

interface ErrorModalProps {
  /** Raw error message/detail. */
  message: string;
  /** Called on dismiss (backdrop click, Escape, X, or Dismiss button). */
  onClose: () => void;
  /** Optional — if provided, shows a "Try again" action that re-runs the failed request. */
  onRetry?: () => void;
}

/**
 * Modal replacement for the old inline red text line under the chat window.
 * Errors (provider misconfiguration, rate limits, network failures, stream
 * interruptions) are interruptive by nature, so they get a focused modal
 * instead of a line of text that's easy to miss — with the raw detail in a
 * monospace panel so it stays copy-pasteable for debugging, and a one-click
 * retry when the failed turn can be re-run.
 */
export function ErrorModal({ message, onClose, onRetry }: ErrorModalProps) {
  const [copied, setCopied] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
        aria-describedby="error-modal-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/25 bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_48px_-16px_rgba(220,38,38,0.35)] animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/15 to-rose-500/15 text-red-500 ring-1 ring-red-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p id="error-modal-title" className="text-sm font-semibold text-ink">
              Something went wrong
            </p>
            <p className="mt-0.5 text-xs text-muted">The last message couldn&apos;t be completed.</p>
          </div>
          <IconButton ref={closeRef} label="Dismiss" onClick={onClose} className="-mr-1.5 -mt-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="px-5 pt-4">
          <div
            id="error-modal-description"
            className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-raised px-3 py-2.5 font-mono text-xs leading-relaxed text-ink/90"
          >
            {message}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy error"}
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Dismiss
            </Button>
            {onRetry && (
              <Button
                size="sm"
                onClick={() => {
                  onRetry();
                  onClose();
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}