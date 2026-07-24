import { DocumentSection } from "./document-ir";

export interface Chunk {
  id: string;                 // uuid
  documentId: string;
  page?: number;                // present for PDF chunks
  sheet?: string;                 // present for spreadsheet chunks
  section?: string;                // nearest heading, for citation display
  text: string;                     // the actual chunk content sent for embedding + shown to user as citation
  tokenCount: number;
  order: number;                     // position within the document, for stable re-processing/dedup
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  kind: DocumentSection["kind"];
  rowRange?: [number, number];   // for row-group chunks
  tableColumns?: string[];         // denormalized for quick display without re-parsing table JSON
}