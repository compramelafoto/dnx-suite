import type { PDFFont } from "pdf-lib";

const ELLIPSIS = "…";

function normalizeParagraph(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Parte palabras demasiado largas para caber en una línea. */
function splitOversizedWord(word: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) return [word];

  const parts: string[] = [];
  let chunk = "";

  for (const char of word) {
    const candidate = chunk + char;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      chunk = candidate;
    } else {
      if (chunk) parts.push(chunk);
      chunk = char;
    }
  }

  if (chunk) parts.push(chunk);
  return parts.length > 0 ? parts : [word.slice(0, 1)];
}

/**
 * Envuelve texto usando métricas reales de la fuente (`widthOfTextAtSize`).
 * Respeta saltos de línea explícitos (`\n`).
 */
export function wrapTextByWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0) return [];
  if (!text.trim()) return [];

  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalizeParagraph(paragraph);
    if (!normalized) {
      lines.push("");
      continue;
    }

    const words = normalized.split(" ");
    let current = "";

    for (let word of words) {
      const wordParts = splitOversizedWord(word, font, fontSize, maxWidth);
      for (const part of wordParts) {
        const candidate = current ? `${current} ${part}` : part;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = part;
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

export function truncateTextToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string {
  const normalized = normalizeParagraph(text);
  if (!normalized) return "";
  if (font.widthOfTextAtSize(normalized, fontSize) <= maxWidth) return normalized;

  let truncated = normalized;
  while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}${ELLIPSIS}`, fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return truncated.length > 0 ? `${truncated}${ELLIPSIS}` : ELLIPSIS;
}

export function resolveLineHeight(fontSize: number, multiplier = 1.4): number {
  return Math.max(fontSize * multiplier, fontSize + 2);
}

export function commercialInitialsFromLabel(label: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "?";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}
