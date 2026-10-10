/**
 * Comparar nombres de autor sin importar acentos, mayúsculas ni espacios. Vive aparte para que
 * `visibility.ts` la use sin un ciclo de imports con `profile.ts` (que la reexporta).
 */
export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sameName(a: string, b: string): boolean {
  const x = normalizeName(a);
  return x !== "" && x === normalizeName(b);
}
