"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { STARTER_PROMPTS } from "@/features/prompts/types";
import { IconButton } from "@/components/ui/icon-button";

interface PromptMenuProps {
  onSelect: (template: string) => void;
}

export function PromptMenu({ onSelect }: PromptMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <IconButton label="Quick prompts" onClick={() => setOpen((v) => !v)}>
        <Zap className="h-4 w-4" />
      </IconButton>

      {open && (
        <div className="absolute bottom-10 left-0 z-10 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Quick prompts
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {STARTER_PROMPTS.map((p) => (
              <li key={p.id}>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-raised"
                  onClick={() => {
                    onSelect(p.template);
                    setOpen(false);
                  }}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}