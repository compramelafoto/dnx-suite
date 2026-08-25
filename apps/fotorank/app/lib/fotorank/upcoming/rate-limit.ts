/**
 * Rate limiting del botón "Notificarme".
 *
 * Defensa en profundidad: la garantía real de no duplicar está en la restricción
 * única (contestId, userId) de la base. Esto sólo frena ráfagas.
 *
 * In-memory: válido para una instancia. Un despliegue multi-instancia necesita
 * un backend compartido; el contrato `RateLimitStore` permite sustituirlo.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimitStore = {
  consume(key: string, limit: number, windowMs: number, now?: Date): Promise<RateLimitResult>;
};

export function createInMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async consume(key, limit, windowMs, now = new Date()) {
      const t = now.getTime();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= t) {
        bucket = { count: 0, resetAt: t + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, bucket.resetAt - t) };
      }
      bucket.count += 1;
      return { allowed: true, remaining: Math.max(0, limit - bucket.count), retryAfterMs: 0 };
    },
  };
}

/** Hash no reversible: nunca se usa la IP cruda como clave persistida. */
export function hashRateLimitSubject(raw: string): string {
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `rl_${(h >>> 0).toString(16)}`;
}

export const INTEREST_RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

/** Store compartido del proceso. */
export const interestRateLimitStore = createInMemoryRateLimitStore();
