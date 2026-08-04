/**
 * Rate limit in-memory (sliding fixed window) por IP+ruta.
 * Fail-closed con 429 cuando se excede. Suficiente para RC; producción multi-instancia
 * debería migrar a store compartido (Redis) más adelante.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  accountCreate: { limit: 5, windowMs: 60_000 },
  login: { limit: 10, windowMs: 60_000 },
  googleOAuth: { limit: 20, windowMs: 60_000 },
  registrationCreate: { limit: 8, windowMs: 60_000 },
  emailEnqueue: { limit: 15, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export function clientIpFromHeaders(headers: Headers | { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return ip;
}

export function consumeRateLimit(
  routeKey: string,
  subject: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  const key = `${routeKey}:${subject}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + policy.windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
      limit: policy.limit,
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - bucket.count),
    retryAfterMs: 0,
    limit: policy.limit,
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const retrySec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      error: {
        code: "RATE_LIMITED",
        message: "Demasiadas solicitudes. Probá de nuevo en unos segundos.",
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retrySec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

/** Test helper */
export function __resetRateLimitStoreForTests() {
  buckets.clear();
}
