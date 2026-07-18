import type { DaniCopyEntry } from "./dani-copy-catalog.js";

/** Hash estable (FNV-1a 32-bit) para selección determinista. */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Elige una variante de forma determinista.
 * Evita IDs recién usados cuando hay alternativas.
 */
export function pickDeterministicCopy(
  candidates: readonly DaniCopyEntry[],
  seed: string,
  recentIds: readonly string[],
): DaniCopyEntry {
  if (candidates.length === 0) {
    throw new Error("DANI_COPY_EMPTY");
  }
  const fresh = candidates.filter((c) => !recentIds.includes(c.id));
  const pool = fresh.length > 0 ? fresh : [...candidates];
  const idx = stableHash(seed) % pool.length;
  return pool[idx]!;
}
