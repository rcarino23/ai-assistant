"use client";

import * as React from "react";
import { CheckCircle2, X } from "lucide-react";
import { IconButton } from "./icon-button";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 animate-toast-in">
      <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface/95 px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_16px_32px_-12px_rgba(0,0,0,0.3)] backdrop-blur-md">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium text-ink">{message}</span>
        <IconButton label="Dismiss" onClick={onClose} className="-mr-1 h-5 w-5">
          <X className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}