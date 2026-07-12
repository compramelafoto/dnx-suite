export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }

  const seconds = Number(header);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

export function calculateBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(exponential + jitter, maxDelayMs);
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const retryableStatuses = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const retryable =
        error instanceof RetryableRequestError &&
        isRetryableStatus(error.status, retryableStatuses);

      if (!retryable || attempt >= options.maxRetries) {
        throw error;
      }

      const delayMs =
        error.retryAfterMs ?? calculateBackoffMs(attempt, options.baseDelayMs, maxDelayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export class RetryableRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RetryableRequestError";
  }
}
