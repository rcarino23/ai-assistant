"use client";

import * as React from "react";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import type { SavedPrompt } from "@/features/prompts/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PromptManagerProps {
  prompts: SavedPrompt[];
  onAdd: (data: { title: string; template: string; folder?: string }) => void;
  onUpdate: (id: string, patch: Partial<Omit<SavedPrompt, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
}

type FormState = { title: string; template: string; folder: string };
const EMPTY_FORM: FormState = { title: "", template: "", folder: "" };

export function PromptManager({
  prompts,
  onAdd,
  onUpdate,
  onDelete,
  onToggleFavorite,
  onClose,
}: PromptManagerProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const showForm = creating || editingId !== null;

  const startEdit = (prompt: SavedPrompt) => {
    setCreating(false);
    setEditingId(prompt.id);
    setForm({ title: prompt.title, template: prompt.template, folder: prompt.folder ?? "" });
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  };

  const cancelForm = () => {
    setEditingId(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const submitForm = () => {
    if (!form.title.trim() || !form.template.trim()) return;
    if (editingId) {
      onUpdate(editingId, {
        title: form.title.trim(),
        template: form.template,
        folder: form.folder.trim() || undefined,
      });
    } else {
      onAdd(form);
    }
    cancelForm();
  };

  const confirmDelete = (id: string) => {
    onDelete(id);
    setPendingDeleteId(null);
    if (editingId === id) cancelForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-ink">Quick prompts</p>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!showForm && (
            <button
              onClick={startCreate}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2 text-sm font-medium text-ink hover:bg-surface-raised"
            >
              <Plus className="h-4 w-4" /> New prompt
            </button>
          )}

          {showForm && (
            <div className="mb-4 space-y-2 rounded-xl border border-accent bg-surface p-3">
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                value={form.folder}
                onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))}
                placeholder="Folder (optional)"
                className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <Textarea
                value={form.template}
                onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
                placeholder="Prompt template — use {{text}} where your typed text should go"
                rows={4}
                className="rounded-lg border border-border px-2.5 py-1.5"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submitForm} disabled={!form.title.trim() || !form.template.trim()}>
                  {editingId ? "Save changes" : "Add prompt"}
                </Button>
              </div>
            </div>
          )}

          {prompts.length === 0 && !showForm && (
            <p className="py-6 text-center text-sm text-muted">No prompts yet.</p>
          )}

          <ul className="space-y-1.5">
            {prompts.map((p) => (
              <li key={p.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                      {p.folder && (
                        <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[0.6875rem] text-muted">
                          {p.folder}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.template}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label={p.favorite ? "Unfavorite" : "Favorite"} onClick={() => onToggleFavorite(p.id)}>
                      <Star className={cn("h-3.5 w-3.5", p.favorite && "fill-current text-accent")} />
                    </IconButton>
                    <IconButton label="Edit prompt" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Delete prompt" onClick={() => setPendingDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>

                {pendingDeleteId === p.id && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5">
                    <span className="text-xs text-red-500">Delete {p.title}? This can&apos;t be undone.</span>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-500 text-white hover:opacity-90"
                        onClick={() => confirmDelete(p.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}