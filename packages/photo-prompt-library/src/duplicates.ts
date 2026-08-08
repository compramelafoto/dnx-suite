import { normalizeTitle } from "./normalize";

export type DuplicateCandidate = {
  id: string;
  title: string;
  normalizedTitle: string;
};

export type ExactDuplicateMatch = {
  normalizedTitle: string;
  items: DuplicateCandidate[];
};

export type SimilarityWarning = {
  a: DuplicateCandidate;
  b: DuplicateCandidate;
  score: number;
  /** Solo advertencia — nunca fusionar automáticamente. */
  kind: "similarity_warning";
};

function tokenize(normalized: string): Set<string> {
  return new Set(
    normalized
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  );
}

/** Jaccard sobre tokens de palabras del título normalizado. */
export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(normalizeTitle(a));
  const tb = tokenize(normalizeTitle(b));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function findExactNormalizedDuplicates(
  items: DuplicateCandidate[],
): ExactDuplicateMatch[] {
  const byNorm = new Map<string, DuplicateCandidate[]>();
  for (const item of items) {
    const key = item.normalizedTitle || normalizeTitle(item.title);
    const list = byNorm.get(key) ?? [];
    list.push(item);
    byNorm.set(key, list);
  }
  const out: ExactDuplicateMatch[] = [];
  for (const [normalizedTitle, group] of byNorm) {
    if (group.length > 1) {
      out.push({ normalizedTitle, items: group });
    }
  }
  return out;
}

/**
 * Advertencias de similitud (Jaccard). Nunca merge — solo warning.
 * @param threshold default 0.72
 */
export function findSimilarityWarnings(
  items: DuplicateCandidate[],
  threshold = 0.72,
): SimilarityWarning[] {
  const warnings: SimilarityWarning[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i]!;
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j]!;
      const na = a.normalizedTitle || normalizeTitle(a.title);
      const nb = b.normalizedTitle || normalizeTitle(b.title);
      if (na === nb) continue; // exactos van por otro camino
      const score = jaccardSimilarity(a.title, b.title);
      if (score >= threshold) {
        warnings.push({ a, b, score, kind: "similarity_warning" });
      }
    }
  }
  return warnings;
}
