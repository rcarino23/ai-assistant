export interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  sizeBytes: number;
  addedAt: number;
  /** Whether this item is currently folded into outgoing requests. */
  enabled: boolean;
}