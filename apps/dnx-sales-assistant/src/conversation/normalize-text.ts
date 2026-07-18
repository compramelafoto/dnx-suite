/** Normaliza texto de mensaje: trim + colapso de espacios internos. */
export function normalizeMessageText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
