import type { JSONContent } from "@tiptap/core";
import { extractPlainTextFromContentJson } from "@/lib/blog/tiptap-content-utils";

/** Palabras por minuto para lectura en español (promedio conservador). */
export const BLOG_WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Calcula minutos de lectura desde texto plano. Mínimo 1 si hay contenido. */
export function calculateReadingTimeMinutes(text: string, wordsPerMinute = BLOG_WORDS_PER_MINUTE): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/** Calcula minutos de lectura desde contentJson de TipTap. */
export function calculateReadingTimeFromContentJson(
  contentJson: JSONContent,
  wordsPerMinute = BLOG_WORDS_PER_MINUTE
): number {
  const plainText = extractPlainTextFromContentJson(contentJson);
  return calculateReadingTimeMinutes(plainText, wordsPerMinute);
}
