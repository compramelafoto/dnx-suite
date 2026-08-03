let totalRenders = 0;
let totalFailures = 0;
let totalCached = 0;
let lastRenderDurationMs = 0;

export function recordRenderSuccess(durationMs: number, cached = false): void {
  totalRenders += 1;
  lastRenderDurationMs = durationMs;
  if (cached) totalCached += 1;
}

export function recordRenderFailure(): void {
  totalFailures += 1;
}

export function getWorkerMetricsSnapshot(): {
  totalRenders: number;
  totalFailures: number;
  totalCached: number;
  lastRenderDurationMs: number;
} {
  return {
    totalRenders,
    totalFailures,
    totalCached,
    lastRenderDurationMs,
  };
}

export function __resetWorkerMetricsForTests(): void {
  totalRenders = 0;
  totalFailures = 0;
  totalCached = 0;
  lastRenderDurationMs = 0;
}
