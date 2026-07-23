"use client";

import * as React from "react";
import { v4 as uuid } from "uuid";
import { Menu } from "lucide-react";
import type { ChatMessage, Conversation } from "@/types";
import { DEFAULT_PROVIDER_SETTINGS } from "@/types";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatWindow } from "@/components/chat/chat-window";
import { useProviders } from "@/features/providers/use-providers";
import { loadConversations, saveConversations, deriveTitle } from "@/features/chat/persistence";
import { KnowledgePanel } from "@/components/chat/knowledge-panel";
import { useKnowledgeBank } from "@/features/knowledge-bank/use-knowledge-bank";
import { IconButton } from "@/components/ui/icon-button";
import { Toast } from "@/components/ui/toast";
import { ErrorModal } from "@/components/chat/error-modal";

function createConversation(providerId: string, model: string): Conversation {
  const now = Date.now();
  return {
    id: uuid(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    providerId,
    model,
  };
}

export default function Home() {
  const { providers } = useProviders();
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  // Off-canvas on mobile, static on md+/lg+ regardless of this state
  // (handled entirely with CSS breakpoints, see Sidebar/KnowledgePanel).
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = React.useState(true);
  const [dbToast, setDbToast] = React.useState<string | null>(null);
  const [dbSchemaError, setDbSchemaError] = React.useState<string | null>(null);

  const {
    items: knowledgeItems,
    enabledItems: enabledKnowledgeItems,
    addFiles: addKnowledgeFiles,
    addText: addKnowledgeText,
    removeItem: removeKnowledgeItem,
    toggleEnabled: toggleKnowledgeItem,
    error: knowledgeError,
    setError: setKnowledgeError,
    addDatabaseSnapshot,
    addTableData,
    dbPulling,
    dbTables,
    dbTablesLoading,
    fetchDbTables,
    addAllTableData
  } = useKnowledgeBank();

  React.useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [conversations, hydrated]);

  const defaultProviderId = providers.find((p) => p.configured)?.id ?? "anthropic";

  const handleNew = () => {
    const conversation = createConversation(defaultProviderId, DEFAULT_PROVIDER_SETTINGS.model);
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false); // auto-close the drawer on mobile after picking a chat
  };

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    void fetch(`/api/knowledge/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  };

  const updateActiveConversation = (patch: Partial<Conversation>) => {
    if (!activeId) return;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, ...patch, updatedAt: Date.now() } : c)));
  };

  const handleRename = (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, titleManuallySet: true, updatedAt: Date.now() } : c))
    );
  };

  const handlePullDbSchema = React.useCallback(async () => {
    try {
      await addDatabaseSnapshot();
      setDbToast("Database schema pulled successfully.");
    } catch (err) {
      setDbSchemaError(err instanceof Error ? err.message : "Failed to pull database schema.");
    }
  }, [addDatabaseSnapshot]);

  const handlePullTableData = React.useCallback(
    async (table: string, format: "json" | "csv") => {
      try {
        await addTableData(table, format);
        setDbToast(`${table} (${format.toUpperCase()}) pulled successfully.`);
      } catch (err) {
        setDbSchemaError(err instanceof Error ? err.message : `Failed to pull data for "${table}".`);
      }
    },
    [addTableData]
  );

  const handlePullAllTableData = React.useCallback(
    async (format: "json" | "csv") => {
      try {
        await addAllTableData(format);
        setDbToast(`All tables (${format.toUpperCase()}) pulled successfully.`);
      } catch (err) {
        setDbSchemaError(err instanceof Error ? err.message : "Failed to pull all table data.");
      }
    },
    [addAllTableData]
  );

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeProvider = providers.find((p) => p.id === active?.providerId);

  if (!hydrated) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      {/* Backdrop for either drawer on mobile/tablet */}
      {(sidebarOpen || knowledgeOpen) && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setKnowledgeOpen(false);
          }}
        />
      )}

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        onRename={handleRename}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <ChatHeader
              providers={providers}
              providerId={active.providerId}
              model={active.model}
              onProviderChange={(providerId) => {
                const provider = providers.find((p) => p.id === providerId);
                updateActiveConversation({ providerId, model: provider?.models[0]?.id ?? active.model });
              }}
              onModelChange={(model) => updateActiveConversation({ model })}
              onToggleKnowledge={() => setKnowledgeOpen((v) => !v)}
              knowledgeOpen={knowledgeOpen}
              onToggleSidebar={() => setSidebarOpen(true)}
            />
            <div className="min-h-0 flex-1">
              <ChatWindow
                key={active.id}
                conversationId={active.id}
                providerId={active.providerId}
                providerConfigured={activeProvider?.configured ?? false}
                providerName={activeProvider?.name ?? active.providerId}
                settings={{ ...DEFAULT_PROVIDER_SETTINGS, model: active.model }}
                initialMessages={active.messages}
                onMessagesChange={(messages: ChatMessage[]) => {
                  updateActiveConversation({
                    messages,
                    title: active.titleManuallySet ? active.title : deriveTitle({ ...active, messages }),
                  });
                }}
                knowledgeItems={enabledKnowledgeItems}
              />
            </div>
          </>
        ) : (
          <>
            {/* No ChatHeader when there's no active conversation, so give
                mobile a way to reach the sidebar here too. */}
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4 md:hidden">
              <IconButton label="Open menu" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </IconButton>
              <span className="text-sm font-semibold text-ink">AI Assistant</span>
            </div>
            <EmptyState onNew={handleNew} />
          </>
        )}
      </div>

      {knowledgeOpen && (
        <KnowledgePanel
          items={knowledgeItems}
          error={knowledgeError}
          onAddFiles={addKnowledgeFiles}
          onAddText={addKnowledgeText}
          onRemove={removeKnowledgeItem}
          onToggle={toggleKnowledgeItem}
          onDismissError={() => setKnowledgeError(null)}
          onClose={() => setKnowledgeOpen(false)}
          onAddDatabaseSnapshot={handlePullDbSchema}
          onAddTableData={handlePullTableData}
          dbPulling={dbPulling}
          dbTables={dbTables}
          dbTablesLoading={dbTablesLoading}
          onFetchDbTables={fetchDbTables}
          onAddAllTableData={handlePullAllTableData}
        />
      )}

      {dbToast && <Toast message={dbToast} onClose={() => setDbToast(null)} />}

      {dbSchemaError && (
        <ErrorModal
          message={dbSchemaError}
          onClose={() => setDbSchemaError(null)}
          onRetry={handlePullDbSchema}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-base font-medium text-ink">No chat selected</p>
      <button onClick={onNew} className="text-sm text-accent underline underline-offset-2">
        Start a new chat
      </button>
    </div>
  );
}