/**
 * Not wired into the UI yet. A saved prompt is just template text that
 * gets inserted into MessageInput's textarea (with {{variables}} expanded),
 * so adding the prompt library later is additive to MessageInput, not a
 * rearchitecture.
 */
export interface SavedPrompt {
  id: string;
  title: string;
  template: string;
  folder?: string;
  favorite: boolean;
  createdAt: number;
}

export const STARTER_PROMPTS: SavedPrompt[] = [
  { id: "summarize", title: "Summarize", template: "Summarize the following:\n\n{{text}}", favorite: true, createdAt: Date.now() },
  { id: "explain", title: "Explain", template: "Explain this simply:\n\n{{text}}", favorite: false, createdAt: Date.now() },
  { id: "rewrite-professional", title: "Rewrite professionally", template: "Rewrite this professionally:\n\n{{text}}", favorite: false, createdAt: Date.now() },
  { id: "generate-sql", title: "Generate SQL", template: "Write a SQL query that:\n\n{{text}}", favorite: false, createdAt: Date.now() },
];
