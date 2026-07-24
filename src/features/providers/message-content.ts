import type { ChatMessage } from "@/types";

export const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * Prepends any extracted attachment text (txt/md/csv/json/xml/pdf/docx/xlsx)
 * to the message content as plain text. Used by every provider that doesn't
 * have a native multi-part "document" content type — i.e. everyone except
 * Anthropic, which builds its own document blocks instead.
 */
export function withAttachmentText(message: ChatMessage): string {
  const textDocs = (message.attachments ?? []).filter((a) => a.selectedAsContext && a.extractedText);
  if (textDocs.length === 0) return message.content;

  const docsBlock = textDocs
    .map((doc) => `<document name="${doc.name}">\n${doc.extractedText}\n</document>`)
    .join("\n\n");

  return message.content ? `${docsBlock}\n\n${message.content}` : docsBlock;
}

export function imageAttachments(message: ChatMessage) {
  return (message.attachments ?? []).filter(
    (a) =>
      a.selectedAsContext &&
      a.type === "image" &&
      a.base64Data &&
      a.mediaType &&
      SUPPORTED_IMAGE_TYPES.has(a.mediaType)
  );
}