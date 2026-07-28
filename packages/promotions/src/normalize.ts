/**
 * Normalización segura de códigos promocionales.
 * - trim
 * - uppercase
 * - colapsa whitespace interno
 * - solo A–Z, 0–9, _ y -
 */
export function normalizePromotionCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
}

export function isValidPromotionCodeFormat(code: string): boolean {
  if (!code || code.length < 3 || code.length > 40) return false;
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(code);
}
