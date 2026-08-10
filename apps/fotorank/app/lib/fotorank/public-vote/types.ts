export type PublicVoteRoundStatus =
  | "DRAFT"
  | "READY"
  | "SCHEDULED"
  | "OPEN"
  | "CLOSING"
  | "PENDING_FINAL_SNAPSHOT"
  | "CLOSED"
  | "TIEBREAK_REQUIRED"
  | "FINALIZED"
  | "CANCELLED"
  | "ERROR";

export type PublicVoteRoundType = "NORMAL" | "TIEBREAK";

export type PublicVoteCutoffPolicy =
  | "LAST_VALID_OBSERVATION_BEFORE_CUTOFF"
  | "EXACT_PROVIDER_TIMESTAMP"
  | "PROVIDER_FINAL_SNAPSHOT";

export type PublicVoteProviderName = "NONE" | "TEST_PROVIDER" | "INSTAGRAM" | "INSTAGRAM_FUTURE";

export type ProviderHealth =
  | "CONNECTED"
  | "DEGRADED"
  | "STALE"
  | "ERROR"
  | "EXPIRED"
  | "REAUTH_REQUIRED"
  | "PERMISSION_MISSING"
  | "RATE_LIMITED";

export type ResultsPublicationStatus = "CALCULATED" | "REVIEWED" | "PUBLISHED";

export type NormalizedMetricObservation = {
  candidatePublicCode: string;
  metricValue: number;
  providerObservedAt: Date;
  providerMetricTimestamp?: Date | null;
  providerEventKey: string;
  rawHash?: string | null;
  metadata?: Record<string, unknown>;
};

export type PublicVoteProviderAdapter = {
  name: PublicVoteProviderName;
  health(): Promise<ProviderHealth>;
  /** Lectura sintética / futura; TestProvider genera métricas en memoria. */
  fetchObservations?(input: {
    roundId: string;
    publicCodes: string[];
    asOf: Date;
  }): Promise<NormalizedMetricObservation[]>;
};
