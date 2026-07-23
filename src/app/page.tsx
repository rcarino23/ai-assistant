"use client";

import * as React from "react";
import { v4 as uuid } from "uuid";
import type { ChatMessage, Conversation } from "@/types";
import { DEFAULT_PROVIDER_SETTINGS } from "@/types";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatWindow } from "@/components/chat/chat-window";
import { useProviders } from "@/features/providers/use-providers";
import { loadConversations, saveConversations, deriveTitle } from "@/features/chat/persistence";
import { KnowledgePanel } from "@/components/chat/knowledge-panel";
import { useKnowledgeBank } from "@/features/knowledge-bank/use-knowledge-bank";

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
  const [knowledgeOpen, setKnowledgeOpen] = React.useState(true);
  const {
    items: knowledgeItems,
    enabledItems: enabledKnowledgeItems,
    addFiles: addKnowledgeFiles,
    addText: addKnowledgeText,
    removeItem: removeKnowledgeItem,
    toggleEnabled: toggleKnowledgeItem,
    error: knowledgeError,
    setError: setKnowledgeError,
    addDatabaseSnapshot
  } = useKnowledgeBank();

  // Hydrate from localStorage once on mount.
  React.useEffect(() => {
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setHydrated(true);
  }, []);

  // Persist whenever conversations change (after hydration).
  React.useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [conversations, hydrated]);

  const defaultProviderId = providers.find((p) => p.configured)?.id ?? "anthropic";

  const handleNew = () => {
    const conversation = createConversation(defaultProviderId, DEFAULT_PROVIDER_SETTINGS.model);
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
  };

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    // Free the server-side knowledge cache for this conversation.
    void fetch(`/api/knowledge/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  };

  const updateActiveConversation = (patch: Partial<Conversation>) => {
    if (!activeId) return;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, ...patch, updatedAt: Date.now() } : c)));
  };

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeProvider = providers.find((p) => p.id === active?.providerId);

  if (!hydrated) return null;

  return (
    <div className="flex h-screen w-full bg-canvas">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
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
                  if (messages === active.messages) return;
                  updateActiveConversation({ messages, title: deriveTitle({ ...active, messages }) });
                }}
                knowledgeItems={enabledKnowledgeItems}
              />
            </div>
          </>
        ) : (
          <EmptyState onNew={handleNew} />
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
          onAddDatabaseSnapshot={addDatabaseSnapshot}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-base font-medium text-ink">No chat selected</p>
      <button onClick={onNew} className="text-sm text-accent underline underline-offset-2">
        Start a new chat
      </button>
    </div>
  );
}
