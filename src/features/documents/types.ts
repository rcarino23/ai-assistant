/**
 * Not wired into the UI yet. Intended flow: on upload, extract text
 * server-side (pdf-parse / mammoth / xlsx, depending on `type`), store it
 * here, and prepend selected documents' `extractedText` as extra context
 * in the `messages` array ChatWindow sends to /api/chat — no changes needed
 * to the provider layer, since providers only ever see ChatMessage[].
 */
export type DocumentType =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "csv"
  | "xlsx"
  | "json"
  | "xml"
  | "image"
  | "video"
  | "audio"
  | "other";

export interface UploadedDocument {
  id: string;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  extractedText: string;
  uploadedAt: number;
  selectedAsContext: boolean;
  /** Local object URL for images/video/audio — used for the attachment chip, not sent anywhere. */
  previewUrl?: string;
}