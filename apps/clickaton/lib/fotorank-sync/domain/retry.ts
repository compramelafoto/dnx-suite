import type { SyncErrorClass } from "./types";

/** Backoff documentado Etapa 7 (minutos → ms). */
const RETRY_DELAYS_MS = [
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  60 * 60_000, // 1h
];

export function classifySyncErrorCode(code: string): SyncErrorClass {
  const retryable = new Set([
    "TIMEOUT",
    "DB_UNAVAILABLE",
    "TEMPORARY",
    "LOCK",
    "RATE_LIMIT",
    "PROVIDER_UNAVAILABLE",
  ]);
  return retryable.has(code) ? "RETRYABLE" : "NON_RETRYABLE";
}

export function nextRetryAt(attemptCount: number, now = new Date()): Date | null {
  // attemptCount es el número de intentos ya hechos; el próximo usa índice attemptCount.
  if (attemptCount >= RETRY_DELAYS_MS.length) return null;
  return new Date(now.getTime() + RETRY_DELAYS_MS[attemptCount]!);
}

export function shouldMoveToManualReview(attemptCount: number, errorClass: SyncErrorClass): boolean {
  if (errorClass === "NON_RETRYABLE") return true;
  return attemptCount >= RETRY_DELAYS_MS.length;
}

export { RETRY_DELAYS_MS };
