/**
 * Rate limit in-memory para creación de órdenes TIENDA.
 * Producción: documentar necesidad de rate limit durable (mismo gap que inscripción).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_KEY = 8;

export function assertStoreOrderRateLimit(keys: string[]): { ok: true } | { ok: false } {
  const now = Date.now();
  for (const key of keys) {
    if (!key) continue;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      continue;
    }
    if (bucket.count >= MAX_PER_KEY) {
      return { ok: false };
    }
    bucket.count += 1;
  }
  // Evitar crecimiento ilimitado en dev
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }
  return { ok: true };
}

export function normalizeEmailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

export function clientIpKey(ip: string | null): string {
  return `ip:${ip?.trim() || "unknown"}`;
}
