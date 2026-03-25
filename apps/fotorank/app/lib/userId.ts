/**
 * IDs de usuario (`User.id` en Prisma) son `Int`.
 * Usar al leer valores externos (params, FormData, JSON, cookies legadas).
 */
export function parseUserId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(typeof value === "number" ? value : String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || !Number.isSafeInteger(n)) {
    return null;
  }
  return n;
}
