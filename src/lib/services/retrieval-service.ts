import type { Chunk } from "@/lib/types/chunk";
import type { KnowledgeItem } from "@/features/knowledge-bank/types";
import { getKnowledgeItems } from "@/features/knowledge-bank/server-store";

interface RetrievalOptions {
  conversationId: string;
  question: string;
  items?: KnowledgeItem[];
  topK?: number;
  finalK?: number;
  maxContextTokens?: number;
}

const estimateTokenCount = (text: string) => Math.max(1, Math.ceil(text.length / 4));

function truncateToTokenBudget(chunks: Chunk[], maxContextTokens = 6000): Chunk[] {
  let budget = 0;
  return chunks.filter((chunk) => {
    const nextBudget = budget + chunk.tokenCount;
    if (nextBudget > maxContextTokens) return false;
    budget = nextBudget;
    return true;
  });
}

function toChunk(item: KnowledgeItem, index: number): Chunk {
  return {
    id: `knowledge-${item.id}`,
    documentId: item.id,
    section: item.name,
    text: item.content,
    tokenCount: estimateTokenCount(item.content),
    order: index,
    metadata: {
      kind: "raw",
    },
  };
}

export async function retrieveContext(opts: RetrievalOptions): Promise<{
  chunks: (Chunk & { citation: string })[];
  contextText: string;
}> {
  const requestedItems = opts.items?.length ? opts.items : getKnowledgeItems(opts.conversationId);
  const enabledItems = requestedItems.filter((item) => item.enabled);
  if (enabledItems.length === 0) return { chunks: [], contextText: "" };

  const chunkCandidates = enabledItems.map(toChunk);
  const budgeted = truncateToTokenBudget(chunkCandidates, opts.maxContextTokens ?? 6000);

  const withCitations = budgeted.map((chunk) => ({
    ...chunk,
    citation: chunk.section ?? "source",
  }));

  const contextText = withCitations
    .map((chunk) => `[${chunk.citation}]\n${chunk.text}`)
    .join("\n\n---\n\n");

  return { chunks: withCitations, contextText };
}