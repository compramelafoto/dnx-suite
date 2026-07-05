import type { GatewayConfig } from "./config.js";

type BucketState = {
  timestamps: number[];
};

const buckets = new Map<string, BucketState>();

export function rateLimitKey(userId: number, ftpUsername: string): string {
  return `user:${userId}:${ftpUsername}`;
}

function pruneOldTimestamps(timestamps: number[], windowStart: number): number[] {
  return timestamps.filter((ts) => ts >= windowStart);
}

export type RateLimitCheckResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterMs: number };

/**
 * Comprueba si el fotógrafo puede subir otro archivo dentro de la ventana actual.
 * No registra el intento; llamar a `recordRateLimitedUpload` solo tras éxito completo.
 */
export function checkUploadRateLimit(
  config: GatewayConfig,
  key: string
): RateLimitCheckResult {
  const now = Date.now();
  const windowMs = config.FTP_RATE_LIMIT_WINDOW_MS;
  const maxFiles = config.FTP_RATE_LIMIT_MAX_FILES;
  const windowStart = now - windowMs;

  const bucket = buckets.get(key) ?? { timestamps: [] };
  const recent = pruneOldTimestamps(bucket.timestamps, windowStart);
  buckets.set(key, { timestamps: recent });

  if (recent.length >= maxFiles) {
    const oldest = recent[0] ?? now;
    const retryAfterMs = Math.max(1, oldest + windowMs - now);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxFiles - recent.length };
}

/** Registra una subida exitosa (R2 + encolado). */
export function recordSuccessfulUpload(key: string): void {
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps.push(Date.now());
  buckets.set(key, bucket);
}

/** Solo para tests. */
export function resetRateLimitState(): void {
  buckets.clear();
}
