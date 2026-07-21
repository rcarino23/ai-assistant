"use client";

import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ProviderSummary } from "@/features/providers/use-providers";

interface ChatHeaderProps {
  providers: ProviderSummary[];
  providerId: string;
  model: string;
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
}

export function ChatHeader({ providers, providerId, model, onProviderChange, onModelChange }: ChatHeaderProps) {
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

      <ThemeToggle />
    </header>
  );
}
