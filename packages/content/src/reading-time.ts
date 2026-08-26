import type { JSONContent } from "@tiptap/core";
import { extractPlainTextFromContentJson } from "./tiptap/content-utils";

/** Palabras por minuto para lectura en español (promedio conservador). */
export const CONTENT_WORDS_PER_MINUTE = 200;
/** Alias CLF. */
export const BLOG_WORDS_PER_MINUTE = CONTENT_WORDS_PER_MINUTE;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function calculateReadingTimeMinutes(
  text: string,
  wordsPerMinute = CONTENT_WORDS_PER_MINUTE
): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function calculateReadingTimeFromContentJson(
  contentJson: JSONContent,
  wordsPerMinute = CONTENT_WORDS_PER_MINUTE
): number {
  const plainText = extractPlainTextFromContentJson(contentJson);
  return calculateReadingTimeMinutes(plainText, wordsPerMinute);
}
