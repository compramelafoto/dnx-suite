/**
 * Lifecycle: create rounds → READY → SCHEDULED → OPEN → CLOSING → finalize.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { assertJuryActivationAllowed } from "../jury/commercial-contest-guard";
import { getOrCreateCompetitionJuryConfig } from "../jury/competition-jury-config";
import { PublicVoteError } from "./errors";
import { writePublicVoteAudit } from "./audit";
import { hashCandidates, hashConfig } from "./hashes";
import { getPublicVoteNow, getPublicVoteNowForRound } from "./clock";
import { evaluatePublicVotePhaseReadiness } from "./readiness";
import { createFinalSnapshotForRound } from "./finalize";
import type { PublicVoteCutoffPolicy, PublicVoteProviderName } from "./types";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

function resolveWindow(input: {
  startsAt?: Date | null;
  endsAt?: Date | null;
  durationMinutes: number;
}): { startsAt: Date; endsAt: Date } {
  const startsAt = input.startsAt ?? getPublicVoteNow();
  const endsAt =
    input.endsAt ??
    new Date(startsAt.getTime() + Math.max(1, input.durationMinutes) * 60_000);
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new PublicVoteError("INVALID_INPUT", "endsAt debe ser posterior a startsAt.", 400);
  }
  return { startsAt, endsAt };
}

/** Crea una ronda NORMAL por cada unidad (prompt/categoría) con finalistas CONFIRMED. */
export async function createPublicVoteRoundsFromFinalists(input: {
  contestId: string;
  actorUserId?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  provider?: PublicVoteProviderName;
}) {
  assertJuryActivationAllowed(input.contestId);
  const readiness = await evaluatePublicVotePhaseReadiness(input.contestId);
  if (readiness.status === "SKIP") {
    return { skipped: true as const, reason: "JURY_ONLY_OR_DISABLED", rounds: [] as Awaited<ReturnType<typeof prisma.fotorankPublicVoteRound.findMany>> };
  }
  if (readiness.status !== "READY") {
    throw new PublicVoteError(
      "NOT_READY",
      `Fase pública no READY: ${readiness.reasons.map((r) => r.code).join(",")}`,
      409,
    );
  }

  const config = readiness.config;
  const provider = (input.provider ??
    (config.publicVoteProvider === "TEST_PROVIDER" ? "TEST_PROVIDER" : "TEST_PROVIDER")) as PublicVoteProviderName;
  if (provider !== "TEST_PROVIDER") {
    throw new PublicVoteError("INVALID_INPUT", "17A solo admite TEST_PROVIDER para crear rounds.", 400);
  }

  const { startsAt, endsAt } = resolveWindow({
    startsAt: input.startsAt ?? config.publicVoteStartsAt,
    endsAt: input.endsAt ?? config.publicVoteEndsAt,
    durationMinutes: config.publicVoteDurationMinutes,
  });

  const finalists = await prisma.fotorankFinalistSnapshot.findMany({
    where: { contestId: input.contestId, status: "CONFIRMED" },
    orderBy: [{ promptExternalId: "asc" }, { internalJuryRank: "asc" }],
  });

  const byUnit = new Map<string, typeof finalists>();
  for (const f of finalists) {
    const list = byUnit.get(f.promptExternalId) ?? [];
    list.push(f);
    byUnit.set(f.promptExternalId, list);
  }

  const created = [];
  for (const [unitKey, list] of byUnit) {
    const existing = await prisma.fotorankPublicVoteRound.findFirst({
      where: { contestId: input.contestId, unitKey, roundNumber: 1 },
    });
    if (existing) {
      created.push(existing);
      continue;
    }

    const codes = list.map((f) => f.publicCode);
    const configHash = hashConfig({
      contestId: input.contestId,
      unitKey,
      metric: config.publicVoteMetric,
      provider,
      startsAt,
      endsAt,
      cutoffPolicy: config.publicVoteCutoffPolicy,
      roundType: "NORMAL",
      roundNumber: 1,
    });
    const candidateSnapshotHash = hashCandidates(codes);

    const round = await prisma.fotorankPublicVoteRound.create({
      data: {
        id: newId("pvr"),
        contestId: input.contestId,
        unitKey,
        unitType: config.publicVoteUnit,
        roundNumber: 1,
        roundType: "NORMAL",
        status: "READY",
        metric: config.publicVoteMetric,
        provider,
        cutoffPolicy: config.publicVoteCutoffPolicy as PublicVoteCutoffPolicy,
        startsAt,
        endsAt,
        timezone: config.timezone,
        configHash,
        candidateSnapshotHash,
        staleThresholdMinutes: config.publicVoteStaleThresholdMinutes,
        resultsPublicationStatus: "CALCULATED",
        configVersion: 1,
        metadataJson: { engine: "public-vote-17a", fixtureSafe: true },
        candidates: {
          create: list.map((f, idx) => ({
            id: newId("pvc"),
            finalistSnapshotId: f.id,
            publicCode: f.publicCode,
            entryId: f.entryId,
            sortOrder: idx,
            active: true,
            metadataJson: { internalJuryRank: f.internalJuryRank },
          })),
        },
      },
      include: { candidates: true },
    });
    created.push(round);
    await writePublicVoteAudit({
      contestId: input.contestId,
      actorUserId: input.actorUserId,
      eventType: "PUBLIC_VOTE_READY",
      entityType: "FotorankPublicVoteRound",
      entityId: round.id,
      payload: { unitKey, candidates: codes.length, configHash, candidateSnapshotHash },
    });
  }

  await prisma.fotorankCompetitionJuryConfig.update({
    where: { contestId: input.contestId },
    data: {
      publicVoteStatus: "READY",
      publicVoteStartsAt: startsAt,
      publicVoteEndsAt: endsAt,
      publicVoteProvider: provider,
    },
  });

  return { skipped: false as const, rounds: created, startsAt, endsAt };
}

export async function schedulePublicVoteRound(input: {
  roundId: string;
  actorUserId?: number | null;
  startsAt?: Date;
  endsAt?: Date;
  durationMinutes?: number;
}) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: input.roundId } });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  assertJuryActivationAllowed(round.contestId);
  if (!["DRAFT", "READY", "SCHEDULED"].includes(round.status)) {
    throw new PublicVoteError("INVALID_STATE", `No se puede programar desde ${round.status}.`, 409);
  }

  const config = await getOrCreateCompetitionJuryConfig(round.contestId);
  const { startsAt, endsAt } = resolveWindow({
    startsAt: input.startsAt ?? round.startsAt,
    endsAt: input.endsAt ?? null,
    durationMinutes: input.durationMinutes ?? config.publicVoteDurationMinutes,
  });

  const configHash = hashConfig({
    contestId: round.contestId,
    unitKey: round.unitKey,
    metric: round.metric,
    provider: round.provider,
    startsAt,
    endsAt,
    cutoffPolicy: round.cutoffPolicy,
    roundType: round.roundType,
    roundNumber: round.roundNumber,
  });

  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: { status: "SCHEDULED", startsAt, endsAt, configHash },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_SCHEDULED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
  });
  return updated;
}

export async function openPublicVoteRound(input: {
  roundId: string;
  actorUserId?: number | null;
  /** Forzar apertura aunque now < startsAt (solo test). */
  force?: boolean;
}) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: { candidates: true },
  });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  assertJuryActivationAllowed(round.contestId);
  if (round.status === "OPEN") return { round, idempotent: true };
  if (!["READY", "SCHEDULED"].includes(round.status)) {
    throw new PublicVoteError("INVALID_STATE", `No se puede abrir desde ${round.status}.`, 409);
  }
  const now = getPublicVoteNowForRound(round.provider);
  if (!input.force && now.getTime() < round.startsAt.getTime()) {
    throw new PublicVoteError("NOT_YET", "Aún no llegó startsAt.", 409);
  }
  // Snapshot de candidatos inmutable: no mutar lista
  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: { status: "OPEN", openedAt: now },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_OPENED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { openedAt: now.toISOString(), candidateCount: round.candidates.length },
  });
  return { round: updated, idempotent: false };
}

export async function beginClosingPublicVoteRound(input: {
  roundId: string;
  actorUserId?: number | null;
}) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: input.roundId } });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  if (["CLOSING", "PENDING_FINAL_SNAPSHOT", "FINALIZED", "TIEBREAK_REQUIRED", "CLOSED"].includes(round.status)) {
    return { round, idempotent: true };
  }
  if (round.status !== "OPEN") {
    throw new PublicVoteError("INVALID_STATE", `No se puede cerrar desde ${round.status}.`, 409);
  }
  const now = getPublicVoteNowForRound(round.provider);
  if (now.getTime() < round.endsAt.getTime()) {
    throw new PublicVoteError("NOT_YET", "Aún no llegó endsAt.", 409);
  }
  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: { status: "CLOSING", closedAt: now },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_CLOSING",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { closedAt: now.toISOString() },
  });
  return { round: updated, idempotent: false };
}

export async function closeAndFinalizeRound(input: {
  roundId: string;
  actorUserId?: number | null;
}) {
  await beginClosingPublicVoteRound(input);
  return createFinalSnapshotForRound(input);
}

export async function extendPublicVoteRound(input: {
  roundId: string;
  newEndsAt: Date;
  reason: string;
  actorUserId: number;
}) {
  if (!input.reason.trim()) {
    throw new PublicVoteError("INVALID_INPUT", "Motivo de extensión obligatorio.", 400);
  }
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: input.roundId } });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  assertJuryActivationAllowed(round.contestId);
  if (!["SCHEDULED", "OPEN"].includes(round.status)) {
    throw new PublicVoteError("INVALID_STATE", "Solo se puede extender antes del cierre.", 409);
  }
  const now = getPublicVoteNowForRound(round.provider);
  if (now.getTime() >= round.endsAt.getTime()) {
    throw new PublicVoteError("INVALID_STATE", "No se puede extender después de endsAt.", 409);
  }
  if (input.newEndsAt.getTime() <= round.endsAt.getTime()) {
    throw new PublicVoteError("INVALID_INPUT", "newEndsAt debe ser posterior al endsAt actual.", 400);
  }

  const oldEndsAt = round.endsAt;
  const configHash = hashConfig({
    contestId: round.contestId,
    unitKey: round.unitKey,
    metric: round.metric,
    provider: round.provider,
    startsAt: round.startsAt,
    endsAt: input.newEndsAt,
    cutoffPolicy: round.cutoffPolicy,
    roundType: round.roundType,
    roundNumber: round.roundNumber,
  });

  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: {
      endsAt: input.newEndsAt,
      extendedFromEndsAt: oldEndsAt,
      configHash,
    },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_EXTENDED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: {
      reason: input.reason,
      oldEndsAt: oldEndsAt.toISOString(),
      newEndsAt: input.newEndsAt.toISOString(),
      at: now.toISOString(),
    },
  });
  return updated;
}

export async function cancelPublicVoteRound(input: {
  roundId: string;
  reason: string;
  actorUserId: number;
}) {
  if (!input.reason.trim()) {
    throw new PublicVoteError("INVALID_INPUT", "Motivo de cancelación obligatorio.", 400);
  }
  const round = await prisma.fotorankPublicVoteRound.findUnique({ where: { id: input.roundId } });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  assertJuryActivationAllowed(round.contestId);
  if (round.status === "FINALIZED") {
    throw new PublicVoteError("IMMUTABLE", "No se puede cancelar una ronda FINALIZED.", 409);
  }
  if (round.status === "CANCELLED") return { round, idempotent: true };

  const now = getPublicVoteNow();
  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: input.reason,
    },
  });
  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_CANCELLED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: { reason: input.reason, previousStatus: round.status },
  });
  return { round: updated, idempotent: false };
}

/** Reapertura normal prohibida; solo incidente grave → nueva ronda/revisión. */
export async function reopenPublicVoteRound(input: {
  roundId: string;
  reason: string;
  actorUserId: number;
  isSuperAdmin: boolean;
}) {
  void input;
  throw new PublicVoteError(
    "REOPEN_FORBIDDEN",
    "Reapertura normal prohibida. Crear nueva revisión/ronda con Super Admin; no modificar snapshot final.",
    403,
  );
}
