import type { EditorialBlock } from "@/data/blog/phase8/types";

/** Rangos de palabras objetivo por categoría (Fase 8). */
export const WORD_TARGETS: Record<string, { min: number; max: number }> = {
  guias: { min: 1200, max: 1800 },
  funcionalidades: { min: 1500, max: 2500 },
  comparativas: { min: 2000, max: 3000 },
  "negocio-fotografico": { min: 1800, max: 2500 },
  "casos-de-uso": { min: 1500, max: 2500 },
};

export function wordTargetForCategory(categorySlug: string): { min: number; max: number } {
  return WORD_TARGETS[categorySlug] ?? { min: 1200, max: 2000 };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function countBlocksWords(blocks: EditorialBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    if (block.type === "p" && block.text) total += countWords(block.text);
    if (block.type === "pr" && block.parts) {
      for (const part of block.parts) total += countWords(part.text);
    }
    if (block.type === "h2" && block.text) total += countWords(block.text);
    if (block.type === "h3" && block.text) total += countWords(block.text);
    if (block.type === "ul" && block.items) {
      for (const item of block.items) total += countWords(item);
    }
  }
  return total;
}
