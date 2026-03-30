/**
 * Normalización de textos de categoría (alias, duplicados, slugs).
 * Sin dependencias de servidor: usable en cliente para sugerencias en vivo.
 */

/** Quita tildes y diacríticos (NFD). */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Texto comparable: minúsculas, sin tildes, trim, espacios colapsados,
 * caracteres no alfanuméricos sustituidos por espacio y recolapsado.
 */
export function normalizeCategoryText(raw: string): string {
  const base = stripDiacritics(raw.trim().toLowerCase())
    .replace(/[&]/g, " y ")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ");
  return base.replace(/\s+/g, " ").trim();
}

/** Normalización para índice de alias (más agresiva: sin espacios). */
export function normalizeForAliasKey(raw: string): string {
  return normalizeCategoryText(raw).replace(/\s+/g, "").replace(/-/g, "");
}

/**
 * Slug estable para URLs e identificadores (alineado con `normalizeSlug` de concurso,
 * sin depender de ese módulo en cliente puro si hace falta).
 */
export function slugifyCategoryName(raw: string): string {
  const n = stripDiacritics(raw.trim().toLowerCase())
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return n.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Distancia de Levenshtein (cota pequeña: nombres cortos). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, row[j]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length]!;
}

export type SimilarityBucket = "exact_normalized" | "alias" | "slug" | "fuzzy";

export function similarityScore(normalizedInput: string, normalizedTarget: string): number {
  if (!normalizedInput || !normalizedTarget) return 0;
  if (normalizedInput === normalizedTarget) return 1;
  const maxLen = Math.max(normalizedInput.length, normalizedTarget.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(normalizedInput, normalizedTarget);
  return 1 - dist / maxLen;
}
