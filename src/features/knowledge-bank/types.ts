export interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  sizeBytes: number;
  addedAt: number;
  enabled: boolean;
  source?: "file" | "note" | "database";
}