/**
 * Jobs provider-agnostic (TEST_PROVIDER only en 17A).
 * Retry-safe / idempotente.
 */
import { prisma } from "@repo/db";
import { getPublicVoteNow } from "./clock";
import { ingestObservations } from "./ingest";
import {
  beginClosingPublicVoteRound,
  openPublicVoteRound,
} from "./lifecycle";
import { createFinalSnapshotForRound } from "./finalize";
import { createTiebreakRound } from "./tiebreak";
import {
  buildTestObservations,
  getTestProviderHealth,
  setTestProviderHealth,
} from "./test-provider";
import { writePublicVoteAudit } from "./audit";
import type { ProviderHealth } from "./types";

export async function jobSyncMetrics(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: roundId },
    include: { candidates: { where: { active: true } } },
  });
  if (!round) return { ok: false as const, reason: "NOT_FOUND" };
  if (round.status !== "OPEN" && round.status !== "CLOSING") {
    return { ok: false as const, reason: `STATUS_${round.status}` };
  }
  if (round.provider !== "TEST_PROVIDER") {
    return { ok: false as const, reason: "PROVIDER_NOT_TEST" };
  }

  const health = getTestProviderHealth(roundId);
  if (health === "ERROR") {
    await prisma.fotorankPublicVoteRound.update({
      where: { id: roundId },
      data: { providerHealth: "ERROR", status: round.status === "OPEN" ? "OPEN" : round.status },
    });
    await writePublicVoteAudit({
      contestId: round.contestId,
      eventType: "PUBLIC_VOTE_PROVIDER_ERROR",
      entityType: "FotorankPublicVoteRound",
      entityId: roundId,
      payload: { health },
    });
    return { ok: false as const, reason: "PROVIDER_ERROR" };
  }

  try {
    const obs = buildTestObservations({
      roundId,
      publicCodes: round.candidates.map((c) => c.publicCode),
      asOf: getPublicVoteNow(),
    });
    const result = await ingestObservations({
      roundId,
      observations: obs,
      allowClosingWindow: round.status === "CLOSING",
    });
    let nextHealth: ProviderHealth = health;
    if (health === "DEGRADED") nextHealth = "DEGRADED";
    await prisma.fotorankPublicVoteRound.update({
      where: { id: roundId },
      data: { providerHealth: nextHealth },
    });
    return { ok: true as const, ...result, health: nextHealth };
  } catch (e) {
    setTestProviderHealth(roundId, "ERROR");
    await writePublicVoteAudit({
      contestId: round.contestId,
      eventType: "PUBLIC_VOTE_PROVIDER_ERROR",
      entityType: "FotorankPublicVoteRound",
      entityId: roundId,
      payload: { error: e instanceof Error ? e.message : "unknown" },
    });
    return { ok: false as const, reason: "SYNC_FAILED" };
  }
}

export async function jobCheckDeadline(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: roundId } });
  if (!round) return { action: "NONE" as const };
  const now = getPublicVoteNow();

  if (["READY", "SCHEDULED"].includes(round.status) && now >= round.startsAt) {
    await openPublicVoteRound({ roundId });
    return { action: "OPENED" as const };
  }
  if (round.status === "OPEN" && now >= round.endsAt) {
    await beginClosingPublicVoteRound({ roundId });
    return { action: "CLOSING" as const };
  }
  return { action: "NONE" as const };
}

export async function jobFinalizeRound(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: roundId } });
  if (!round) return { ok: false as const, reason: "NOT_FOUND" };
  if (!["CLOSING", "PENDING_FINAL_SNAPSHOT", "OPEN"].includes(round.status)) {
    if (["FINALIZED", "TIEBREAK_REQUIRED"].includes(round.status)) {
      return { ok: true as const, idempotent: true };
    }
    return { ok: false as const, reason: `STATUS_${round.status}` };
  }
  const now = getPublicVoteNow();
  if (now < round.endsAt) {
    return { ok: false as const, reason: "BEFORE_ENDS_AT" };
  }
  if (round.status === "OPEN") {
    await beginClosingPublicVoteRound({ roundId });
  }
  const result = await createFinalSnapshotForRound({ roundId });
  return { ok: true as const, pending: result.pending, status: result.round.status, idempotent: result.idempotent };
}

export async function jobCreateTiebreak(roundId: string) {
  const snaps = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
    where: { roundId, finalPosition: null },
  });
  if (snaps.length < 2) return { ok: false as const, reason: "NO_TIE" };
  const result = await createTiebreakRound({
    parentRoundId: roundId,
    tiedPublicCodes: snaps.map((s) => s.publicCode),
  });
  return { ok: true as const, roundId: result.round.id, idempotent: result.idempotent };
}

export async function jobCheckProviderHealth(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: roundId } });
  if (!round) return { health: "ERROR" as ProviderHealth };
  let health: ProviderHealth =
    round.provider === "TEST_PROVIDER"
      ? getTestProviderHealth(roundId)
      : (round.providerHealth as ProviderHealth);

  const last = await prisma.fotorankPublicVoteObservation.findFirst({
    where: { roundId },
    orderBy: { providerObservedAt: "desc" },
  });
  const now = getPublicVoteNow();
  if (
    last &&
    health !== "ERROR" &&
    now.getTime() - last.providerObservedAt.getTime() > round.staleThresholdMinutes * 60_000
  ) {
    health = "STALE";
  }
  await prisma.fotorankPublicVoteRound.update({
    where: { id: roundId },
    data: { providerHealth: health },
  });
  return { health };
}

export async function runPublicVoteWorkerPass(contestId: string) {
  const rounds = await prisma.fotorankPublicVoteRound.findMany({
    where: {
      contestId,
      status: {
        in: [
          "READY",
          "SCHEDULED",
          "OPEN",
          "CLOSING",
          "PENDING_FINAL_SNAPSHOT",
          "TIEBREAK_REQUIRED",
        ],
      },
    },
  });
  const results = [];
  for (const r of rounds) {
    const deadline = await jobCheckDeadline(r.id);
    if (r.status === "OPEN" || r.status === "CLOSING") {
      await jobSyncMetrics(r.id);
    }
    if (["CLOSING", "PENDING_FINAL_SNAPSHOT", "OPEN"].includes(r.status) || deadline.action === "CLOSING") {
      await jobFinalizeRound(r.id);
    }
    if (r.status === "TIEBREAK_REQUIRED") {
      await jobCreateTiebreak(r.id);
    }
    await jobCheckProviderHealth(r.id);
    results.push({ roundId: r.id, deadline });
  }
  return results;
}
