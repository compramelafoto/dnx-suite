/**
 * Monitor organizador + salud del provider + timers server-derived.
 */
import { prisma } from "@repo/db";
import { getPublicVoteNow } from "./clock";
import { getTestProviderHealth } from "./test-provider";
import type { ProviderHealth } from "./types";

export type TimerPhase =
  | "STARTS_IN"
  | "OPEN_REMAINING"
  | "CLOSING"
  | "PENDING_VERIFICATION"
  | "FINALIZED"
  | "CANCELLED"
  | "SCHEDULED"
  | "READY"
  | "ERROR";

export function deriveTimer(round: {
  status: string;
  startsAt: Date;
  endsAt: Date;
}): { phase: TimerPhase; msRemaining: number | null; label: string } {
  const now = getPublicVoteNow().getTime();
  if (round.status === "CANCELLED") {
    return { phase: "CANCELLED", msRemaining: null, label: "Cancelada" };
  }
  if (round.status === "FINALIZED") {
    return { phase: "FINALIZED", msRemaining: null, label: "Finalizada" };
  }
  if (round.status === "PENDING_FINAL_SNAPSHOT" || round.status === "CLOSING") {
    return {
      phase: round.status === "PENDING_FINAL_SNAPSHOT" ? "PENDING_VERIFICATION" : "CLOSING",
      msRemaining: null,
      label: round.status === "PENDING_FINAL_SNAPSHOT" ? "Esperando verificación…" : "Cerrando…",
    };
  }
  if (["READY", "SCHEDULED"].includes(round.status) && now < round.startsAt.getTime()) {
    const ms = round.startsAt.getTime() - now;
    return { phase: "STARTS_IN", msRemaining: ms, label: "Empieza en…" };
  }
  if (round.status === "OPEN") {
    const ms = Math.max(0, round.endsAt.getTime() - now);
    return { phase: "OPEN_REMAINING", msRemaining: ms, label: "Votación abierta — faltan…" };
  }
  if (round.status === "ERROR") {
    return { phase: "ERROR", msRemaining: null, label: "Error" };
  }
  if (round.status === "READY") return { phase: "READY", msRemaining: null, label: "Lista" };
  if (round.status === "SCHEDULED") {
    return { phase: "SCHEDULED", msRemaining: null, label: "Programada" };
  }
  return { phase: "FINALIZED", msRemaining: null, label: round.status };
}

export async function getPublicVoteMonitor(contestId: string) {
  const rounds = await prisma.fotorankPublicVoteRound.findMany({
    where: { contestId },
    include: {
      candidates: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      finalSnapshots: true,
      observations: {
        orderBy: { providerObservedAt: "desc" },
        take: 3,
      },
    },
    orderBy: [{ unitKey: "asc" }, { roundNumber: "asc" }],
  });

  const now = getPublicVoteNow();
  let open = 0;
  let closed = 0;
  let error = 0;
  let ties = 0;
  let pending = 0;
  let totalLikesObserved = 0;
  let lastSyncAt: Date | null = null;

  const units = [];
  for (const r of rounds) {
    if (r.status === "OPEN") open += 1;
    if (["CLOSED", "FINALIZED", "TIEBREAK_REQUIRED"].includes(r.status)) closed += 1;
    if (r.status === "ERROR") error += 1;
    if (r.status === "TIEBREAK_REQUIRED") ties += 1;
    if (r.status === "PENDING_FINAL_SNAPSHOT") pending += 1;

    const latestObs = await prisma.fotorankPublicVoteObservation.findFirst({
      where: { roundId: r.id },
      orderBy: { ingestedAt: "desc" },
    });
    if (latestObs && (!lastSyncAt || latestObs.ingestedAt > lastSyncAt)) {
      lastSyncAt = latestObs.ingestedAt;
    }

    // Métricas actuales (último valor por candidato) — operativas, no ranking público
    const currentMetrics: Record<string, number> = {};
    for (const c of r.candidates) {
      const last = await prisma.fotorankPublicVoteObservation.findFirst({
        where: { candidateId: c.id },
        orderBy: { providerObservedAt: "desc" },
      });
      if (last) {
        currentMetrics[c.publicCode] = last.metricValue;
        totalLikesObserved += last.metricValue;
      } else {
        currentMetrics[c.publicCode] = 0;
      }
    }

    let health: ProviderHealth =
      (r.providerHealth as ProviderHealth) || "CONNECTED";
    if (r.provider === "TEST_PROVIDER") {
      health = getTestProviderHealth(r.id);
    }
    const staleMs = r.staleThresholdMinutes * 60_000;
    const isStale =
      latestObs != null && now.getTime() - latestObs.providerObservedAt.getTime() > staleMs;
    if (isStale && health === "CONNECTED") health = "STALE";

    const finalByCode: Record<
      string,
      { finalMetricValue: number; finalPosition: number | null }
    > = {};
    for (const s of r.finalSnapshots) {
      finalByCode[s.publicCode] = {
        finalMetricValue: s.finalMetricValue,
        finalPosition: s.finalPosition,
      };
    }

    units.push({
      roundId: r.id,
      unitKey: r.unitKey,
      roundNumber: r.roundNumber,
      roundType: r.roundType,
      status: r.status,
      provider: r.provider,
      providerHealth: health,
      stale: isStale,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      timer: deriveTimer(r),
      candidates: r.candidates.map((c) => ({
        publicCode: c.publicCode,
        currentMetric: currentMetrics[c.publicCode] ?? 0,
        final: finalByCode[c.publicCode] ?? null,
      })),
      lastSyncAt: latestObs?.ingestedAt ?? null,
      resultsPublicationStatus: r.resultsPublicationStatus,
      configHash: r.configHash,
      candidateSnapshotHash: r.candidateSnapshotHash,
      finalSnapshotHash: r.finalSnapshotHash,
    });
  }

  const normalUnits = rounds.filter((r) => r.roundType === "NORMAL");
  const allNormalFinalized =
    normalUnits.length > 0 &&
    normalUnits.every((r) => r.status === "FINALIZED" || hasResolvedTieTree(rounds, r.id));

  return {
    contestId,
    summary: {
      totalRounds: rounds.length,
      open,
      closed,
      error,
      ties,
      pendingVerification: pending,
      totalLikesObserved,
      lastSyncAt,
      phaseFinalized: allNormalFinalized,
      resultsPublication: "CALCULATED" as const,
      published: false,
    },
    units,
  };
}

function hasResolvedTieTree(
  all: Array<{ id: string; parentRoundId: string | null; status: string }>,
  parentId: string,
): boolean {
  const children = all.filter((r) => r.parentRoundId === parentId);
  if (children.length === 0) return false;
  return children.some(
    (c) => c.status === "FINALIZED" || hasResolvedTieTree(all, c.id),
  );
}

/** Payload público seguro (sin PII / scores / keys). */
export function buildPublicSafeRoundPayload(round: {
  id: string;
  unitKey: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  metric: string;
  roundType: string;
  roundNumber: number;
  candidates: Array<{ publicCode: string }>;
  finalSnapshots?: Array<{
    publicCode: string;
    finalMetricValue: number;
    finalPosition: number | null;
  }>;
}) {
  return {
    roundId: round.id,
    unitKey: round.unitKey,
    status: round.status,
    startsAt: round.startsAt.toISOString(),
    endsAt: round.endsAt.toISOString(),
    metric: round.metric,
    roundType: round.roundType,
    roundNumber: round.roundNumber,
    candidates: round.candidates.map((c) => ({ publicCode: c.publicCode })),
    // Solo métricas finales si FINALIZED; nunca scores de jurado
    finalRanking:
      round.status === "FINALIZED" && round.finalSnapshots
        ? round.finalSnapshots
            .filter((s) => s.finalPosition != null)
            .sort((a, b) => (a.finalPosition ?? 0) - (b.finalPosition ?? 0))
            .map((s) => ({
              publicCode: s.publicCode,
              finalMetricValue: s.finalMetricValue,
              finalPosition: s.finalPosition,
            }))
        : null,
  };
}
