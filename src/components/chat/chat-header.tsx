"use client";

import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ProviderSummary } from "@/features/providers/use-providers";
import { IconButton } from "../ui/icon-button";
import { Database } from "lucide-react";

interface ChatHeaderProps {
  providers: ProviderSummary[];
  providerId: string;
  model: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onToggleKnowledge?: () => void;
  knowledgeOpen?: boolean;
}

export function ChatHeader({ providers, providerId, model, onProviderChange, onModelChange, onToggleKnowledge, knowledgeOpen }: ChatHeaderProps) {
  const activeProvider = providers.find((p) => p.id === providerId);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Select value={providerId} onChange={(e) => onProviderChange(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.configured}>
              {p.name}
              {!p.configured ? " (not configured)" : ""}
            </option>
          ))}
        </Select>

        {activeProvider && (
          <Select value={model} onChange={(e) => onModelChange(e.target.value)}>
            {activeProvider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        {onToggleKnowledge && (
          <IconButton
            label={knowledgeOpen ? "Hide data bank" : "Show data bank"}
            onClick={onToggleKnowledge}
            className={knowledgeOpen ? "text-accent" : undefined}
          >
            <Database className="h-4 w-4" />
          </IconButton>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
