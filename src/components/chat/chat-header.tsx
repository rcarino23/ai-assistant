"use client";

import { Menu } from "lucide-react";
import { Database } from "lucide-react";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ProviderSummary } from "@/features/providers/use-providers";
import { IconButton } from "../ui/icon-button";

interface ChatHeaderProps {
  providers: ProviderSummary[];
  providerId: string;
  model: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onToggleKnowledge?: () => void;
  knowledgeOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatHeader({
  providers,
  providerId,
  model,
  onProviderChange,
  onModelChange,
  onToggleKnowledge,
  knowledgeOpen,
  onToggleSidebar,
}: ChatHeaderProps) {
  const activeProvider = providers.find((p) => p.id === providerId);

  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onToggleSidebar && (
          <IconButton label="Open menu" onClick={onToggleSidebar} className="shrink-0 md:hidden">
            <Menu className="h-4 w-4" />
          </IconButton>
        )}
        <Select
          value={providerId}
          onChange={(e) => onProviderChange(e.target.value)}
          className="max-w-[45vw] sm:max-w-none"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.configured}>
              {p.name}
              {!p.configured ? " (not configured)" : ""}
            </option>
          ))}
        </Select>

        {activeProvider && (
          <Select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="max-w-[35vw] sm:max-w-none"
          >
            {activeProvider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
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