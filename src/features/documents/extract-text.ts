"use client";

const TEXT_EXTENSIONS = ["txt", "md", "csv", "json", "xml"];

export function isExtractableFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/");
}

/** Images, video, and audio never get text-extracted — they're just attached. */
export function isPreviewableMedia(file: File): boolean {
  return (
    file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
  );
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}