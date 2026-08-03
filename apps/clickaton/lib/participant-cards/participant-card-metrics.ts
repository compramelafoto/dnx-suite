import type { ClickatonCardErrorCode } from "./participant-card-errors";

export type ParticipantCardMetricOutcome = "success" | "error";

export type ParticipantCardMetricSnapshot = {
  attempts: number;
  successes: number;
  errors: number;
  renderFailures: number;
  rateLimited: number;
  cacheHits: number;
  cacheMisses: number;
  concurrentWaits: number;
  lastDurationMs: number | null;
  lastRemoteDurationMs: number | null;
  lastStoragePutDurationMs: number | null;
  renderDurationSumMs: number;
  renderDurationCount: number;
  storageBytesPut: number;
  workerCircuitState: "CLOSED" | "OPEN" | "HALF_OPEN" | "UNKNOWN";
  errorsByCode: Partial<Record<ClickatonCardErrorCode, number>>;
  byCardType: Partial<Record<"welcome" | "member", number>>;
  byActorKind: Partial<Record<"participant" | "admin", number>>;
  byStatus: Partial<Record<string, number>>;
};

const metrics: ParticipantCardMetricSnapshot = {
  attempts: 0,
  successes: 0,
  errors: 0,
  renderFailures: 0,
  rateLimited: 0,
  cacheHits: 0,
  cacheMisses: 0,
  concurrentWaits: 0,
  lastDurationMs: null,
  lastRemoteDurationMs: null,
  lastStoragePutDurationMs: null,
  renderDurationSumMs: 0,
  renderDurationCount: 0,
  storageBytesPut: 0,
  workerCircuitState: "UNKNOWN",
  errorsByCode: {},
  byCardType: {},
  byActorKind: {},
  byStatus: {},
};

function inc(map: Partial<Record<string, number>>, key: string): void {
  map[key as keyof typeof map] = (map[key as keyof typeof map] ?? 0) + 1;
}

export function recordParticipantCardAttempt(input: {
  cardType: "welcome" | "member";
  actorKind: "participant" | "admin";
}): void {
  metrics.attempts += 1;
  inc(metrics.byCardType, input.cardType);
  inc(metrics.byActorKind, input.actorKind);
}

export function recordParticipantCardSuccess(durationMs: number): void {
  metrics.successes += 1;
  metrics.lastDurationMs = durationMs;
}

export function recordParticipantCardError(code: ClickatonCardErrorCode): void {
  metrics.errors += 1;
  inc(metrics.errorsByCode, code);
  if (
    code === "CLICKATON_CARD_RENDER_FAILED" ||
    code === "CLICKATON_CARD_RENDER_UNAVAILABLE"
  ) {
    metrics.renderFailures += 1;
  }
  if (code === "CLICKATON_CARD_RATE_LIMITED") {
    metrics.rateLimited += 1;
  }
}

export function recordParticipantCardCacheHit(): void {
  metrics.cacheHits += 1;
}

export function recordParticipantCardCacheMiss(): void {
  metrics.cacheMisses += 1;
}

export function recordParticipantCardRenderDuration(durationMs: number): void {
  metrics.renderDurationSumMs += durationMs;
  metrics.renderDurationCount += 1;
  metrics.lastDurationMs = durationMs;
}

export function recordParticipantCardRemoteDuration(durationMs: number): void {
  metrics.lastRemoteDurationMs = durationMs;
}

export function recordParticipantCardStoragePut(durationMs: number, bytes: number): void {
  metrics.lastStoragePutDurationMs = durationMs;
  metrics.storageBytesPut += Math.max(0, bytes);
}

export function recordParticipantCardConcurrentWait(): void {
  metrics.concurrentWaits += 1;
}

export function recordParticipantCardStatus(status: string): void {
  inc(metrics.byStatus, status);
}

export function recordParticipantCardWorkerCircuitState(
  state: "CLOSED" | "OPEN" | "HALF_OPEN"
): void {
  metrics.workerCircuitState = state;
}

/** Métricas agregadas sin PII — safe para logs/diagnóstico. */
export function getParticipantCardMetricsSnapshot(): Readonly<ParticipantCardMetricSnapshot> {
  return {
    ...metrics,
    errorsByCode: { ...metrics.errorsByCode },
    byCardType: { ...metrics.byCardType },
    byActorKind: { ...metrics.byActorKind },
    byStatus: { ...metrics.byStatus },
  };
}

export function getParticipantCardStagingMetricsSummary(): {
  renders: number;
  hits: number;
  misses: number;
  fails: number;
  averageDurationMs: number | null;
  storageBytes: number;
  workerCircuitState: string;
} {
  const avg =
    metrics.renderDurationCount > 0
      ? Math.round(metrics.renderDurationSumMs / metrics.renderDurationCount)
      : null;
  return {
    renders: metrics.renderDurationCount,
    hits: metrics.cacheHits,
    misses: metrics.cacheMisses,
    fails: metrics.renderFailures,
    averageDurationMs: avg,
    storageBytes: metrics.storageBytesPut,
    workerCircuitState: metrics.workerCircuitState,
  };
}

/** Solo para tests. */
export function __resetParticipantCardMetricsForTests(): void {
  metrics.attempts = 0;
  metrics.successes = 0;
  metrics.errors = 0;
  metrics.renderFailures = 0;
  metrics.rateLimited = 0;
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  metrics.concurrentWaits = 0;
  metrics.lastDurationMs = null;
  metrics.lastRemoteDurationMs = null;
  metrics.lastStoragePutDurationMs = null;
  metrics.renderDurationSumMs = 0;
  metrics.renderDurationCount = 0;
  metrics.storageBytesPut = 0;
  metrics.workerCircuitState = "UNKNOWN";
  metrics.errorsByCode = {};
  metrics.byCardType = {};
  metrics.byActorKind = {};
  metrics.byStatus = {};
}
