/**
 * Not wired into the UI yet. This defines the shape the rest of the app
 * (provider calls, settings page, chat header) should target once agents
 * are built: an Agent just resolves to a system prompt + provider defaults,
 * so it can plug into ChatWindow's `settings` prop with no other changes.
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  preferredProviderId: string;
  preferredModel: string;
  promptTemplate?: string;
  isCustom: boolean;
}

export const BUILT_IN_AGENTS: Agent[] = [
  {
    id: "software-engineer",
    name: "Software Engineer",
    description: "General-purpose coding help across languages and frameworks.",
    systemPrompt: "You are a senior software engineer. Be precise, show code, and explain trade-offs briefly.",
    preferredProviderId: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    isCustom: false,
  },
  {
    id: "technical-writer",
    name: "Technical Writer",
    description: "Turns rough notes into clear docs.",
    systemPrompt: "You are a technical writer. Prefer short sentences, concrete examples, and consistent terms.",
    preferredProviderId: "anthropic",
    preferredModel: "claude-sonnet-4-6",
    isCustom: false,
  },
];
