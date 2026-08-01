/**
 * Rate limiting de webhook — interfaz inyectable.
 *
 * - noop: documentado, no finge protección durable
 * - in-memory: BEST EFFORT (no durable en serverless multi-instancia)
 */

export type WebhookRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  backend: "noop" | "memory";
};

export type CommunicationWebhookRateLimiter = {
  consume(input: {
    /** Clave opaca (nunca email). Ej. hash de IP o "global". */
    key: string;
  }): Promise<WebhookRateLimitResult>;
};

export type WebhookRateLimitConfig = {
  enabled: boolean;
  requests: number;
  windowSeconds: number;
};

export function createNoopWebhookRateLimiter(): CommunicationWebhookRateLimiter {
  return {
    async consume() {
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        retryAfterSeconds: 0,
        backend: "noop",
      };
    },
  };
}

/**
 * BEST EFFORT in-memory — no presentar como durable en serverless.
 */
export function createInMemoryWebhookRateLimiter(
  config: WebhookRateLimitConfig,
): CommunicationWebhookRateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const limit = Math.max(1, config.requests);
  const windowMs = Math.max(1, config.windowSeconds) * 1000;

  return {
    async consume({ key }) {
      if (!config.enabled) {
        return {
          allowed: true,
          remaining: limit,
          retryAfterSeconds: 0,
          backend: "memory",
        };
      }
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(Math.max(0, bucket.resetAt - now) / 1000),
          backend: "memory",
        };
      }
      bucket.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSeconds: 0,
        backend: "memory",
      };
    },
  };
}
