"use client";

import * as React from "react";
import { v4 as uuid } from "uuid";
import type { KnowledgeItem } from "./types";
import { loadKnowledgeItems, saveKnowledgeItems } from "./persistence";

const MAX_ITEMS = 20;
const MAX_ITEM_SIZE = 2 * 1024 * 1024; // 2MB — this gets inlined into every prompt
const SCHEMA_ITEM_PREFIX = "DB schema";

const BINARY_EXTENSIONS = new Set([
  "pdf", "docx", "xlsx", "png", "jpg", "jpeg", "gif", "webp",
  "mp4", "mov", "mp3", "wav", "zip",
]);

function isLikelyBinary(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BINARY_EXTENSIONS.has(ext)) return true;
  return (
    file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function useKnowledgeBank() {
  const [items, setItems] = React.useState<KnowledgeItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dbPulling, setDbPulling] = React.useState(false);

  // Table list for the "Table data" picker — fetched lazily the first time
  // that mode is selected, not on every panel render.
  const [dbTables, setDbTables] = React.useState<string[]>([]);
  const [dbTablesLoading, setDbTablesLoading] = React.useState(false);

  React.useEffect(() => {
    setItems(loadKnowledgeItems());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) saveKnowledgeItems(items);
  }, [items, hydrated]);

  const addFiles = React.useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);

      if (items.length + list.length > MAX_ITEMS) {
        setError(`You can keep up to ${MAX_ITEMS} items in the data bank.`);
        return;
      }

      for (const file of list) {
        if (isLikelyBinary(file)) {
          setError(`"${file.name}" isn't readable as text/code yet, so it was skipped.`);
          continue;
        }
        if (file.size > MAX_ITEM_SIZE) {
          setError(`"${file.name}" is larger than ${Math.round(MAX_ITEM_SIZE / (1024 * 1024))}MB and was skipped.`);
          continue;
        }
        try {
          const content = await readFileAsText(file);
          const item: KnowledgeItem = {
            id: uuid(),
            name: file.name,
            content,
            sizeBytes: file.size,
            addedAt: Date.now(),
            enabled: true,
          };
          setItems((prev) => [item, ...prev]);
        } catch {
          setError(`Couldn't read "${file.name}".`);
        }
      }
    },
    [items.length]
  );

  const addText = React.useCallback((name: string, content: string) => {
    if (!content.trim()) return;
    const item: KnowledgeItem = {
      id: uuid(),
      name: name.trim() || "Untitled note",
      content,
      sizeBytes: content.length,
      addedAt: Date.now(),
      enabled: true,
    };
    setItems((prev) => [item, ...prev]);
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleEnabled = React.useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));
  }, []);

  const fetchDbTables = React.useCallback(async () => {
    setDbTablesLoading(true);
    try {
      const res = await fetch("/api/database/schema");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load table list.");
      const names = ((data.snapshot?.tables ?? []) as { name: string }[]).map((t) => t.name);
      setDbTables(names);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table list.");
    } finally {
      setDbTablesLoading(false);
    }
  }, []);

  const addDatabaseSnapshot = React.useCallback(async () => {
    setDbPulling(true);
    try {
      const res = await fetch("/api/database/schema");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to pull database schema.");
      }
      const item: KnowledgeItem = {
        id: uuid(),
        name: `${SCHEMA_ITEM_PREFIX} (${new Date().toLocaleString()})`,
        content: data.text,
        sizeBytes: data.text.length,
        addedAt: Date.now(),
        enabled: true,
        source: "database",
      };
      // Only replace a previous *schema* snapshot — table-data pulls use a
      // different name prefix, so they're untouched.
      setItems((prev) => [item, ...prev.filter((p) => !p.name.startsWith(SCHEMA_ITEM_PREFIX))]);
    } finally {
      setDbPulling(false);
    }
  }, []);

  const addTableData = React.useCallback(async (table: string, format: "json" | "csv") => {
    setDbPulling(true);
    try {
      const res = await fetch(`/api/database/table-data?table=${encodeURIComponent(table)}&format=${format}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to pull data for "${table}".`);
      }
      const item: KnowledgeItem = {
        id: uuid(),
        name: `${table}.${format} (${new Date().toLocaleString()})`,
        content: data.text,
        sizeBytes: data.text.length,
        addedAt: Date.now(),
        enabled: true,
        source: "database",
      };
      // Replace a previous pull of the *same* table+format, keep others.
      setItems((prev) => [item, ...prev.filter((p) => p.name !== item.name && !p.name.startsWith(`${table}.${format} (`))]);
    } finally {
      setDbPulling(false);
    }
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const enabledItems = React.useMemo(() => items.filter((i) => i.enabled), [items]);

  return {
    items,
    enabledItems,
    hydrated,
    addFiles,
    addText,
    removeItem,
    toggleEnabled,
    clear,
    error,
    setError,
    addDatabaseSnapshot,
    addTableData,
    dbPulling,
    dbTables,
    dbTablesLoading,
    fetchDbTables,
  };
}