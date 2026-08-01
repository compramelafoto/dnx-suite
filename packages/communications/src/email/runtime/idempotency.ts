import { randomBytes } from "node:crypto";

/**
 * Genera idempotency key segura para smoke tests.
 * No contiene email, API key ni PII.
 *
 * Alcance: se envía al proveedor si soporta Idempotency-Key.
 * No hay persistencia local — no garantiza anti-duplicados propia.
 */
export function createSmokeIdempotencyKey(prefix = "comm_smoke"): string {
  const stamp = Date.now().toString(36);
  const rand = randomBytes(8).toString("hex");
  return `${prefix}_${stamp}_${rand}`;
}

/** Vista parcial para logs (sin valor completo innecesario). */
export function maskIdempotencyKey(key: string): string {
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}
