/**
 * Tiebreak público recursivo — NUNCA jury score / azar / orden alfabético de negocio.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { assertJuryActivationAllowed } from "../jury/commercial-contest-guard";
import { getOrCreateCompetitionJuryConfig } from "../jury/competition-jury-config";
import { PublicVoteError } from "./errors";
import { writePublicVoteAudit } from "./audit";
import { hashCandidates, hashConfig } from "./hashes";
import { getPublicVoteNow } from "./clock";
import { createFinalSnapshotForRound } from "./finalize";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

export async function createTiebreakRound(input: {
  parentRoundId: string;
  tiedPublicCodes: string[];
  actorUserId?: number | null;
  startsAt?: Date;
  endsAt?: Date;
  durationMinutes?: number;
}) {
  if (input.tiedPublicCodes.length < 2) {
    throw new PublicVoteError("INVALID_INPUT", "Tiebreak requiere ≥2 candidatos.", 400);
  }

  const parent = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.parentRoundId },
    include: { candidates: { where: { active: true } } },
  });
  if (!parent) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda padre no encontrada.", 404);
  assertJuryActivationAllowed(parent.contestId);
  if (parent.status !== "TIEBREAK_REQUIRED") {
    throw new PublicVoteError(
      "INVALID_STATE",
      `Padre debe estar TIEBREAK_REQUIRED (actual: ${parent.status}).`,
      409,
    );
  }

  // Idempotencia: si ya existe child open/scheduled/ready con mismos códigos, devolver
  const existingChild = await prisma.fotorankPublicVoteRound.findFirst({
    where: {
      parentRoundId: parent.id,
      status: { in: ["DRAFT", "READY", "SCHEDULED", "OPEN", "CLOSING", "PENDING_FINAL_SNAPSHOT", "TIEBREAK_REQUIRED", "FINALIZED"] },
    },
    include: { candidates: true },
    orderBy: { roundNumber: "desc" },
  });
  if (existingChild) {
    const codes = new Set(existingChild.candidates.map((c) => c.publicCode));
    const same =
      input.tiedPublicCodes.every((c) => codes.has(c)) &&
      codes.size === input.tiedPublicCodes.length;
    if (same) {
      return { round: existingChild, idempotent: true };
    }
  }

  const config = await getOrCreateCompetitionJuryConfig(parent.contestId);
  const duration = input.durationMinutes ?? config.publicVoteDurationMinutes;
  const startsAt = input.startsAt ?? getPublicVoteNow();
  const endsAt =
    input.endsAt ?? new Date(startsAt.getTime() + Math.max(1, duration) * 60_000);

  const parentCands = parent.candidates.filter((c) =>
    input.tiedPublicCodes.includes(c.publicCode),
  );
  if (parentCands.length !== input.tiedPublicCodes.length) {
    throw new PublicVoteError("INVALID_INPUT", "Códigos de tiebreak no coinciden con el padre.", 400);
  }

  const nextNumber =
    (await prisma.fotorankPublicVoteRound.aggregate({
      where: { contestId: parent.contestId, unitKey: parent.unitKey },
      _max: { roundNumber: true },
    }))._max.roundNumber ?? parent.roundNumber;
  const roundNumber = nextNumber + 1;

  const codes = parentCands.map((c) => c.publicCode);
  const configHash = hashConfig({
    contestId: parent.contestId,
    unitKey: parent.unitKey,
    metric: parent.metric,
    provider: parent.provider,
    startsAt,
    endsAt,
    cutoffPolicy: parent.cutoffPolicy,
    roundType: "TIEBREAK",
    roundNumber,
  });

  const round = await prisma.fotorankPublicVoteRound.create({
    data: {
      id: newId("pvr"),
      contestId: parent.contestId,
      unitKey: parent.unitKey,
      unitType: parent.unitType,
      roundNumber,
      roundType: "TIEBREAK",
      parentRoundId: parent.id,
      status: "READY",
      metric: parent.metric,
      provider: parent.provider,
      cutoffPolicy: parent.cutoffPolicy,
      startsAt,
      endsAt,
      timezone: parent.timezone,
      configHash,
      candidateSnapshotHash: hashCandidates(codes),
      staleThresholdMinutes: parent.staleThresholdMinutes,
      resultsPublicationStatus: "CALCULATED",
      metadataJson: {
        engine: "public-vote-17a",
        tiebreakOf: parent.id,
        tiedPublicCodes: codes,
      },
      candidates: {
        create: parentCands.map((c, idx) => ({
          id: newId("pvc"),
          finalistSnapshotId: c.finalistSnapshotId,
          publicCode: c.publicCode,
          entryId: c.entryId,
          sortOrder: idx,
          active: true,
          metadataJson: { fromParentCandidateId: c.id },
        })),
      },
    },
    include: { candidates: true },
  });

  await writePublicVoteAudit({
    contestId: parent.contestId,
    actorUserId: input.actorUserId,
    eventType: "PUBLIC_VOTE_TIEBREAK_CREATED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: {
      parentRoundId: parent.id,
      roundNumber,
      tiedPublicCodes: codes,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  });

  return { round, idempotent: false };
}

/**
 * Tras finalizar un tiebreak, fusiona posiciones en el árbol de la unidad.
 * - Ganador del tiebreak por 1.º → posición 1; perdedor → 2; resto del padre mantiene.
 * - Empate recursivo → deja TIEBREAK_REQUIRED en el child.
 */
export async function resolveUnitPositionsAfterTiebreak(input: {
  tiebreakRoundId: string;
  actorUserId?: number | null;
}) {
  const tb = await createFinalSnapshotForRound({
    roundId: input.tiebreakRoundId,
    actorUserId: input.actorUserId,
  });
  if (tb.pending || tb.round.status === "TIEBREAK_REQUIRED") {
    return { ...tb, unitFinalized: false };
  }
  if (tb.round.status !== "FINALIZED") {
    return { ...tb, unitFinalized: false };
  }

  // Orden del tiebreak determina ranking relativo entre empatados
  const tbSnaps = [...tb.snapshots].sort((a, b) => {
    if (a.finalPosition == null && b.finalPosition == null) return 0;
    if (a.finalPosition == null) return 1;
    if (b.finalPosition == null) return -1;
    return a.finalPosition - b.finalPosition;
  });

  const parentId = tb.round.parentRoundId;
  if (!parentId) return { ...tb, unitFinalized: true };

  const parentSnaps = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
    where: { roundId: parentId },
  });
  const parent = await prisma.fotorankPublicVoteRound.findUniqueOrThrow({
    where: { id: parentId },
  });

  // Posiciones ya fijas del padre
  const fixed = parentSnaps
    .filter((s) => s.finalPosition != null)
    .sort((a, b) => (a.finalPosition ?? 0) - (b.finalPosition ?? 0));
  const openSlots = parentSnaps
    .filter((s) => s.finalPosition == null)
    .map((s) => s.publicCode);

  // Primer slot libre = min posición faltante
  const used = new Set(fixed.map((s) => s.finalPosition!));
  let nextSlot = 1;
  const assignSlot = () => {
    while (used.has(nextSlot)) nextSlot += 1;
    const s = nextSlot;
    used.add(s);
    nextSlot += 1;
    return s;
  };

  for (const snap of tbSnaps) {
    if (!openSlots.includes(snap.publicCode)) continue;
    const pos = assignSlot();
    await prisma.fotorankPublicVoteFinalSnapshot.update({
      where: { id: parentSnaps.find((p) => p.publicCode === snap.publicCode)!.id },
      data: { finalPosition: pos },
    });
  }

  // Verificar que el padre quedó completo
  const refreshed = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
    where: { roundId: parentId },
  });
  const incomplete = refreshed.some((s) => s.finalPosition == null);
  if (!incomplete) {
    await prisma.fotorankPublicVoteRound.update({
      where: { id: parentId },
      data: { status: "FINALIZED", resultsPublicationStatus: "CALCULATED" },
    });
    await writePublicVoteAudit({
      contestId: parent.contestId,
      actorUserId: input.actorUserId,
      eventType: "PUBLIC_VOTE_FINALIZED",
      entityType: "FotorankPublicVoteRound",
      entityId: parentId,
      payload: { viaTiebreak: input.tiebreakRoundId, published: false },
    });
    return { ...tb, unitFinalized: true };
  }
  return { ...tb, unitFinalized: false };
}
