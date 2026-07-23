import type { UploadedDocument } from "@/features/documents/types";

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "streaming" | "done" | "error" | "stopped";

export interface ActivityStep {
  id: string;
  label: string;
  status: "active" | "done";
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  model?: string;
  attachments?: UploadedDocument[];
  activity?: ActivityStep[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  archived?: boolean;
  providerId: string;
  model: string;
  titleManuallySet?: boolean;
}

export interface ProviderSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  model: "claude-sonnet-4-6",
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
};

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "activity"; id: string; label: string; status: "active" | "done" }
  | { type: "done" }
  | { type: "error"; message: string };