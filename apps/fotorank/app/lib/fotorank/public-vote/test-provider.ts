/**
 * ETAPA 17A — TestProvider sintético (sin red). Permite simular likes ±, latencia,
 * errores, duplicados, empates y health states.
 */
import { createHash, randomBytes } from "node:crypto";
import type {
  NormalizedMetricObservation,
  ProviderHealth,
  PublicVoteProviderAdapter,
} from "./types";

type MetricState = {
  value: number;
  lastEventKey?: string;
};

const store = new Map<string, Map<string, MetricState>>();
const healthByRound = new Map<string, ProviderHealth>();

function roundStore(roundId: string) {
  let m = store.get(roundId);
  if (!m) {
    m = new Map();
    store.set(roundId, m);
  }
  return m;
}

export const testProvider: PublicVoteProviderAdapter = {
  name: "TEST_PROVIDER",
  async health() {
    return "CONNECTED";
  },
};

export function setTestProviderHealth(roundId: string, health: ProviderHealth) {
  healthByRound.set(roundId, health);
}

export function getTestProviderHealth(roundId: string): ProviderHealth {
  return healthByRound.get(roundId) ?? "CONNECTED";
}

export function resetTestProvider(roundId?: string) {
  if (roundId) {
    store.delete(roundId);
    healthByRound.delete(roundId);
    return;
  }
  store.clear();
  healthByRound.clear();
}

export function setTestProviderMetric(input: {
  roundId: string;
  publicCode: string;
  value: number;
  eventKey?: string;
}) {
  const m = roundStore(input.roundId);
  m.set(input.publicCode, {
    value: input.value,
    lastEventKey: input.eventKey ?? `set:${input.publicCode}:${input.value}:${randomBytes(4).toString("hex")}`,
  });
}

export function bumpTestProviderMetric(input: {
  roundId: string;
  publicCode: string;
  delta: number;
}) {
  const m = roundStore(input.roundId);
  const prev = m.get(input.publicCode)?.value ?? 0;
  const next = prev + input.delta;
  const eventKey = `bump:${input.publicCode}:${prev}->${next}:${Date.now()}`;
  m.set(input.publicCode, { value: next, lastEventKey: eventKey });
  return { previous: prev, next, eventKey };
}

export function buildTestObservations(input: {
  roundId: string;
  publicCodes: string[];
  asOf: Date;
  /**
   * Prefijo/base de eventKey. Se concatena con el publicCode para no colisionar
   * entre candidaturas de la misma ingesta. Para idempotencia, repetir el mismo base.
   */
  forceEventKey?: string;
}): NormalizedMetricObservation[] {
  const health = getTestProviderHealth(input.roundId);
  if (health === "ERROR") {
    throw new Error("TEST_PROVIDER_UNAVAILABLE");
  }
  const m = roundStore(input.roundId);
  return input.publicCodes.map((code) => {
    const state = m.get(code) ?? { value: 0 };
    const eventKey = input.forceEventKey
      ? `${input.forceEventKey}:${code}`
      : (state.lastEventKey ?? `obs:${code}:${state.value}:${input.asOf.toISOString()}`);
    const raw = `${code}|${state.value}|${input.asOf.toISOString()}`;
    return {
      candidatePublicCode: code,
      metricValue: state.value,
      providerObservedAt: input.asOf,
      providerMetricTimestamp: input.asOf,
      providerEventKey: eventKey,
      rawHash: createHash("sha256").update(raw).digest("hex").slice(0, 32),
      metadata: { testProvider: true, health },
    };
  });
}
