export type BackoffState = {
  attempt: number;
};

export function initialBackoff(): BackoffState {
  return { attempt: 0 };
}

/** Backoff exponencial con tope (ms). Respeta retryAfter de 429. */
export function nextBackoffMs(
  state: BackoffState,
  options?: { retryAfterSeconds?: number; maxMs?: number },
): { delayMs: number; next: BackoffState } {
  if (options?.retryAfterSeconds && options.retryAfterSeconds > 0) {
    return {
      delayMs: Math.min(options.retryAfterSeconds * 1000, options.maxMs ?? 60_000),
      next: { attempt: state.attempt + 1 },
    };
  }
  const base = Math.min(
    1000 * 2 ** Math.min(state.attempt, 5),
    options?.maxMs ?? 30_000,
  );
  const jitter = Math.floor(Math.random() * 250);
  return {
    delayMs: base + jitter,
    next: { attempt: state.attempt + 1 },
  };
}

export function resetBackoff(): BackoffState {
  return { attempt: 0 };
}
