/**
 * Normalización de nombres geográficos (texto).
 */

export function normalizePlaceToken(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeCountryCode(
  code: string | null | undefined,
): string | null {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return c;
}

export function formatProvinceName(
  value: string | null | undefined,
): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatCityName(value: string | null | undefined): string | null {
  return formatProvinceName(value);
}

/** Comparación laxa ciudad/provincia. */
export function placesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizePlaceToken(a);
  const nb = normalizePlaceToken(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
