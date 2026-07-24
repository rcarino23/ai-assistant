import { Chunk } from "../types/chunk";
import { ParsedDocument, SourceFormat } from "../types/document-ir";
import { DocumentMetadata } from "../types/metadata";

export interface DocumentProcessor {
  /** Which formats this processor handles. */
  supports: SourceFormat[];
  parse(input: { buffer: Buffer; filename: string; mimeType: string }): Promise<ParsedDocument>;
}

export interface Chunker {
  chunk(doc: ParsedDocument, opts?: { maxTokens?: number }): Chunk[];
}

export interface EmbeddingProvider {
  id: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;   // batched
}

export interface VectorStore {
  upsert(records: { chunkId: string; documentId: string; vector: number[] }[]): Promise<void>;
  query(params: {
    vector: number[];
    topK: number;
    filter?: { documentIds?: string[] };
  }): Promise<{ chunkId: string; score: number }[]>;
  delete(documentId: string): Promise<void>;
}

export interface Reranker {
  rerank(query: string, candidates: { chunkId: string; text: string }[], topN: number):
    Promise<{ chunkId: string; score: number }[]>;
}

export interface MetadataExtractor {
  infer(doc: ParsedDocument, sampleChunks: Chunk[]): Promise<DocumentMetadata>;
}