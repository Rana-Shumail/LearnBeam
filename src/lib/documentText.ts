import { getDocumentUrl } from "./db";
import { extractDocumentText } from "./syllabus";

export type StoredDocumentLike = {
  id: string;
  name: string;
  storagePath: string | null;
  textContent: string | null;
};

export function hasReadableDocumentText(textContent: string | null | undefined) {
  if (!textContent || textContent.trim().length === 0) return false;
  // Binary-garbage strings (e.g. PPTX read via file.text()) count as unreadable
  return !isBinaryGarbage(textContent);
}

/**
 * Returns true when a previously cached textContent is actually raw binary
 * data from a failed text() fallback (e.g. PPTX/XLSX read before proper
 * parsers were wired in). Such strings start with the ZIP magic bytes "PK"
 * or contain a high density of non-printable control characters.
 */
export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length < 8) return false;
  // ZIP magic bytes (PPTX / DOCX / XLSX are ZIP archives)
  if (text.startsWith("PK")) return true;
  // Scan first 300 chars for control/non-printable characters
  const sample = text.slice(0, 300);
  const nonPrintable = (sample.match(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g) ?? []).length;
  return nonPrintable / sample.length > 0.08;
}

export async function hydrateStoredDocumentText(doc: StoredDocumentLike): Promise<string> {
  // If we already have clean, readable text, return it immediately.
  if (typeof doc.textContent === "string" && !isBinaryGarbage(doc.textContent)) {
    return doc.textContent;
  }
  // textContent is null OR was cached as binary garbage (e.g. PPTX before
  // proper parsers existed) — re-extract from the stored file.
  if (!doc.storagePath) return "";

  try {
    const file = await hydrateStoredDocumentFile(doc);
    if (!file) return "";

    return await extractDocumentText(file);
  } catch {
    // Empty string marks that we already tried to read this file in the client.
    return "";
  }
}

export async function hydrateStoredDocumentFile(doc: StoredDocumentLike): Promise<File | null> {
  if (!doc.storagePath) return null;

  try {
    const signedUrl = await getDocumentUrl(doc.storagePath);
    if (!signedUrl) return null;

    const response = await fetch(signedUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new File([blob], doc.name, {
      type: blob.type || undefined,
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
}
