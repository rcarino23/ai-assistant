import type { Chunk } from "@/lib/types/chunk";
import type { ParsedDocument, SourceFormat } from "@/lib/types/document-ir";
import type { DocumentMetadata } from "@/lib/types/metadata";

const contentHash = (value: string) => value;

const storage = {
  download: async (storageUrl: string) => {
    void storageUrl;
    return Buffer.from("");
  },
};

const chunker = {
  chunk: (doc: ParsedDocument, opts?: { maxTokens?: number }): Chunk[] => {
    void doc;
    void opts;
    return [];
  },
};

const metadataExtractor = {
  infer: async (doc: ParsedDocument, sampleChunks: Chunk[]): Promise<DocumentMetadata> => {
    void doc;
    void sampleChunks;
    return { title: "", documentType: "", keywords: [], summary: "" };
  },
};

const embeddingProvider = {
  id: "stub-embedding-provider",
  dimensions: 1536,
  embed: async (texts: string[]) => texts.map(() => Array.from({ length: 1536 }, () => 0)),
};

const vectorStore = {
  upsert: async (_records: { chunkId: string; documentId: string; vector: number[] }[]) => {
    void _records;
  },
  query: async () => [],
  delete: async () => {},
};

const getCachedEmbeddings = async (keys: string[]) => {
  void keys;
  return new Map<string, number[]>();
};
const cacheEmbeddings = async (chunks: Chunk[], vectors: number[][]) => {
  void chunks;
  void vectors;
};

const getProcessorFor = (format: SourceFormat) => ({
  supports: [format] as SourceFormat[],
  parse: async (input: { buffer: Buffer; filename: string; mimeType: string }) => {
    void input;
    return {
      documentId: "",
      format,
      sections: [],
      raw: {},
    } satisfies ParsedDocument;
  },
});

const getDocumentRow = async (documentId: string) => {
  void documentId;
  return {
    storageUrl: "",
    filename: "",
    format: "txt" as SourceFormat,
    mimeType: "text/plain",
  };
};

const saveChunks = async (documentId: string, chunks: Chunk[]) => {
  void documentId;
  void chunks;
};
const saveMetadata = async (documentId: string, metadata: DocumentMetadata) => {
  void documentId;
  void metadata;
};
const setStatus = async (documentId: string, status: string) => {
  void documentId;
  void status;
};
const setProgress = async (documentId: string, completed: number, total: number) => {
  void documentId;
  void completed;
  void total;
};

export async function ingestDocument(documentId: string) {
  await setStatus(documentId, "parsing");
  const doc = await getDocumentRow(documentId);
  const buffer = await storage.download(doc.storageUrl);

  const processor = getProcessorFor(doc.format);
  const parsed = await processor.parse({ buffer, filename: doc.filename, mimeType: doc.mimeType });

  await setStatus(documentId, "chunking");
  const chunks = chunker.chunk(parsed, { maxTokens: 500 });
  await saveChunks(documentId, chunks);

  const [metadata] = await Promise.all([
    metadataExtractor.infer(parsed, chunks.slice(0, 10)),
    (async () => {
      await setStatus(documentId, "embedding");
      await embedAndStoreInBatches(documentId, chunks, { batchSize: 96 });
    })(),
  ]);

  await saveMetadata(documentId, metadata);
  await setStatus(documentId, "ready");
}

async function embedAndStoreInBatches(
  documentId: string,
  chunks: Chunk[],
  opts: { batchSize: number }
) {
  for (let i = 0; i < chunks.length; i += opts.batchSize) {
    const batch = chunks.slice(i, i + opts.batchSize);
    const cacheHits = await getCachedEmbeddings(batch.map((chunk) => contentHash(chunk.text)));
    const toEmbed = batch.filter((chunk) => !cacheHits.has(contentHash(chunk.text)));

    const vectors = toEmbed.length ? await embeddingProvider.embed(toEmbed.map((chunk) => chunk.text)) : [];
    await cacheEmbeddings(toEmbed, vectors);

    const records = [
      ...toEmbed.map((chunk, idx) => ({ chunkId: chunk.id, documentId, vector: vectors[idx] })),
      ...batch
        .filter((chunk) => cacheHits.has(contentHash(chunk.text)))
        .map((chunk) => ({ chunkId: chunk.id, documentId, vector: cacheHits.get(contentHash(chunk.text))! })),
    ];
    await vectorStore.upsert(records);
    await setProgress(documentId, i + batch.length, chunks.length);
  }
}