/**
 * Ingesta append-only + idempotente de observaciones.
 */
import { prisma } from "@repo/db";
import { randomBytes } from "node:crypto";
import { PublicVoteError } from "./errors";
import { writePublicVoteAudit } from "./audit";
import type { NormalizedMetricObservation } from "./types";
import { getPublicVoteNow } from "./clock";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

export async function ingestObservations(input: {
  roundId: string;
  observations: NormalizedMetricObservation[];
  source?: string;
  actorUserId?: number | null;
  /** Si true, permite ingestar aunque la ronda no esté OPEN (p. ej. CLOSING/PENDING). */
  allowClosingWindow?: boolean;
}) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: { candidates: { where: { active: true } } },
  });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);

  const allowedStatuses = input.allowClosingWindow
    ? ["OPEN", "CLOSING", "PENDING_FINAL_SNAPSHOT"]
    : ["OPEN"];
  if (!allowedStatuses.includes(round.status)) {
    throw new PublicVoteError(
      "INVALID_STATE",
      `No se pueden ingerir métricas en estado ${round.status}.`,
      409,
    );
  }

  const byCode = new Map(round.candidates.map((c) => [c.publicCode, c]));
  let inserted = 0;
  let duplicates = 0;
  let late = 0;

  for (const obs of input.observations) {
    const candidate = byCode.get(obs.candidatePublicCode);
    if (!candidate) continue;

    const existing = await prisma.fotorankPublicVoteObservation.findUnique({
      where: {
        roundId_providerEventKey: {
          roundId: round.id,
          providerEventKey: obs.providerEventKey,
        },
      },
    });
    if (existing) {
      duplicates += 1;
      continue;
    }

    const prev = await prisma.fotorankPublicVoteObservation.findFirst({
      where: { roundId: round.id, candidateId: candidate.id },
      orderBy: { providerObservedAt: "desc" },
      select: { metricValue: true },
    });
    const isDecreasing = prev != null && obs.metricValue < prev.metricValue;
    const isLate = obs.providerObservedAt.getTime() > round.endsAt.getTime();
    if (isLate) late += 1;

    try {
      await prisma.fotorankPublicVoteObservation.create({
        data: {
          id: newId("pvo"),
          roundId: round.id,
          candidateId: candidate.id,
          metricValue: obs.metricValue,
          providerObservedAt: obs.providerObservedAt,
          providerMetricTimestamp: obs.providerMetricTimestamp ?? null,
          ingestedAt: getPublicVoteNow(),
          source: input.source ?? "TEST_PROVIDER",
          providerEventKey: obs.providerEventKey,
          rawHash: obs.rawHash ?? null,
          isDecreasing,
          isLate,
          metadataJson: (obs.metadata ?? {}) as object,
        },
      });
      inserted += 1;
    } catch (e) {
      // Carrera concurrente: unique (roundId, providerEventKey) → idempotente
      const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
      const msg = e instanceof Error ? e.message : String(e);
      if (code === "P2002" || msg.includes("Unique constraint failed")) {
        duplicates += 1;
        continue;
      }
      throw e;
    }
  }

  if (inserted > 0) {
    await writePublicVoteAudit({
      contestId: round.contestId,
      actorUserId: input.actorUserId,
      eventType: "PUBLIC_VOTE_OBSERVATION_INGESTED",
      entityType: "FotorankPublicVoteRound",
      entityId: round.id,
      payload: { inserted, duplicates, late, at: getPublicVoteNow().toISOString() },
    });
  }

  return { inserted, duplicates, late };
}
