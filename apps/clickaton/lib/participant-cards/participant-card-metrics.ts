import type { ClickatonCardErrorCode } from "./participant-card-errors";

export type ParticipantCardMetricOutcome = "success" | "error";

export type ParticipantCardMetricSnapshot = {
  attempts: number;
  successes: number;
  errors: number;
  renderFailures: number;
  rateLimited: number;
  lastDurationMs: number | null;
  errorsByCode: Partial<Record<ClickatonCardErrorCode, number>>;
  byCardType: Partial<Record<"welcome" | "member", number>>;
  byActorKind: Partial<Record<"participant" | "admin", number>>;
};

const metrics: ParticipantCardMetricSnapshot = {
  attempts: 0,
  successes: 0,
  errors: 0,
  renderFailures: 0,
  rateLimited: 0,
  lastDurationMs: null,
  errorsByCode: {},
  byCardType: {},
  byActorKind: {},
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

/** Métricas agregadas sin PII — safe para logs/diagnóstico. */
export function getParticipantCardMetricsSnapshot(): Readonly<ParticipantCardMetricSnapshot> {
  return {
    ...metrics,
    errorsByCode: { ...metrics.errorsByCode },
    byCardType: { ...metrics.byCardType },
    byActorKind: { ...metrics.byActorKind },
  };
}

/** Solo para tests. */
export function __resetParticipantCardMetricsForTests(): void {
  metrics.attempts = 0;
  metrics.successes = 0;
  metrics.errors = 0;
  metrics.renderFailures = 0;
  metrics.rateLimited = 0;
  metrics.lastDurationMs = null;
  metrics.errorsByCode = {};
  metrics.byCardType = {};
  metrics.byActorKind = {};
}
