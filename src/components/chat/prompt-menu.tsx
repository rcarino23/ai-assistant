"use client";

import * as React from "react";
import { Settings2, Zap } from "lucide-react";
import { usePrompts } from "@/features/prompts/use-prompts";
import { IconButton } from "@/components/ui/icon-button";
import { PromptManager } from "./prompt-manager";

interface PromptMenuProps {
  onSelect: (template: string) => void;
}

export function PromptMenu({ onSelect }: PromptMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { prompts, addPrompt, updatePrompt, deletePrompt, toggleFavorite } = usePrompts();

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
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Quick prompts</p>
            <IconButton
              label="Manage prompts"
              onClick={() => {
                setManagerOpen(true);
                setOpen(false);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {prompts.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-muted">No prompts yet.</li>
            )}
            {prompts.map((p) => (
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

      {managerOpen && (
        <PromptManager
          prompts={prompts}
          onAdd={addPrompt}
          onUpdate={updatePrompt}
          onDelete={deletePrompt}
          onToggleFavorite={toggleFavorite}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
}