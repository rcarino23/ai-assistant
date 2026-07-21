"use client";

import * as React from "react";
import { Pin, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import type { Conversation } from "@/types";
import { cn, truncate } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onTogglePin }: SidebarProps) {
  const [query, setQuery] = React.useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );
  const pinned = filtered.filter((c) => c.pinned);
  const recent = filtered.filter((c) => !c.pinned);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">AI Assistant</span>
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {pinned.length > 0 && (
          <ConversationGroup
            label="Pinned"
            items={pinned}
            activeId={activeId}
            onSelect={onSelect}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        )}
        <ConversationGroup
          label="Recent"
          items={recent}
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
        {filtered.length === 0 && (
          <p className="mt-6 text-center text-xs text-muted">No chats found.</p>
        )}
      </div>
    </aside>
  );
}

function ConversationGroup({
  label,
  items,
  activeId,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  label: string;
  items: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1 px-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <ul className="space-y-0.5">
        {items.map((c) => (
          <li key={c.id}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer",
                c.id === activeId ? "bg-surface-raised text-ink" : "text-muted hover:bg-surface-raised hover:text-ink"
              )}
              onClick={() => onSelect(c.id)}
            >
              <span className="flex-1 truncate">{truncate(c.title || "New chat", 28)}</span>
              <IconButton
                label={c.pinned ? "Unpin chat" : "Pin chat"}
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(c.id);
                }}
              >
                <Pin className={cn("h-3 w-3", c.pinned && "fill-current")} />
              </IconButton>
              <IconButton
                label="Delete chat"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
