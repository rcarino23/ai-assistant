/**
 * Not wired into a settings page yet. Shape mirrors what the spec's
 * Settings page needs; `ProviderSettings` (src/types/index.ts) already
 * covers model/temperature/maxTokens/topP per conversation.
 */
export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: string;
  defaultProviderId: string;
  defaultAgentId?: string;
  defaultSystemPrompt?: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  language: "en",
  defaultProviderId: "anthropic",
};
