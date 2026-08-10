/**
 * Snapshot final + ranking + detección de empates.
 * Nunca usa score del jurado.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { PublicVoteError } from "./errors";
import { writePublicVoteAudit } from "./audit";
import { candidateIntegrityHash, hashFinalSnapshot } from "./hashes";
import { getPublicVoteNow } from "./clock";
import type { PublicVoteCutoffPolicy } from "./types";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

const EPSILON = 1e-9;
function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= EPSILON;
}

type CandMetric = {
  candidateId: string;
  publicCode: string;
  value: number;
  observationId: string | null;
  providerObservedAt: Date | null;
};

async function resolveMetricForCandidate(input: {
  roundId: string;
  candidateId: string;
  publicCode: string;
  endsAt: Date;
  cutoffPolicy: PublicVoteCutoffPolicy;
}): Promise<CandMetric | null> {
  const whereBase = {
    roundId: input.roundId,
    candidateId: input.candidateId,
  };

  if (input.cutoffPolicy === "EXACT_PROVIDER_TIMESTAMP") {
    const obs = await prisma.fotorankPublicVoteObservation.findFirst({
      where: {
        ...whereBase,
        OR: [
          { providerMetricTimestamp: { lte: input.endsAt } },
          {
            providerMetricTimestamp: null,
            providerObservedAt: { lte: input.endsAt },
          },
        ],
      },
      orderBy: [{ providerMetricTimestamp: "desc" }, { providerObservedAt: "desc" }],
    });
    if (!obs) return null;
    return {
      candidateId: input.candidateId,
      publicCode: input.publicCode,
      value: obs.metricValue,
      observationId: obs.id,
      providerObservedAt: obs.providerObservedAt,
    };
  }

  // LAST_VALID_OBSERVATION_BEFORE_CUTOFF + PROVIDER_FINAL_SNAPSHOT (sin provider real)
  const obs = await prisma.fotorankPublicVoteObservation.findFirst({
    where: {
      ...whereBase,
      providerObservedAt: { lte: input.endsAt },
      isLate: false,
    },
    orderBy: { providerObservedAt: "desc" },
  });
  if (!obs) return null;
  return {
    candidateId: input.candidateId,
    publicCode: input.publicCode,
    value: obs.metricValue,
    observationId: obs.id,
    providerObservedAt: obs.providerObservedAt,
  };
}

/**
 * Detecta códigos empatados que afectan posiciones 1..positionsNeeded.
 * Ejemplo: [500,450,450] → B,C; [500,500,430] → A,B; [500,500,500] → A,B,C.
 */
export function detectTieAffectingPositions(
  ranked: Array<{ publicCode: string; value: number }>,
  positionsNeeded: number,
): string[] {
  if (ranked.length <= 1) return [];
  const tied = new Set<string>();

  // Agrupar por valor
  const groups: Array<{ value: number; codes: string[]; startIndex: number }> = [];
  for (let i = 0; i < ranked.length; ) {
    const v = ranked[i]!.value;
    const codes: string[] = [];
    const start = i;
    while (i < ranked.length && nearlyEqual(ranked[i]!.value, v)) {
      codes.push(ranked[i]!.publicCode);
      i += 1;
    }
    groups.push({ value: v, codes, startIndex: start });
  }

  for (const g of groups) {
    if (g.codes.length <= 1) continue;
    // Posiciones provisionales que ocuparía este grupo (1-indexed): startIndex+1 .. startIndex+size
    const firstPos = g.startIndex + 1;
    const lastPos = g.startIndex + g.codes.length;
    // Afecta si solapa con 1..positionsNeeded
    if (firstPos <= positionsNeeded) {
      for (const c of g.codes) tied.add(c);
    } else if (firstPos <= positionsNeeded + (g.codes.length - 1) && lastPos > positionsNeeded) {
      // Cut boundary: empate cruzando el corte de posiciones
      for (const c of g.codes) tied.add(c);
    }
  }
  return [...tied];
}

/**
 * Asigna posiciones definitivas cuando no hay empate, o parciales (solo no-empatados) cuando sí.
 * Los empatados quedan con finalPosition=null hasta tiebreak.
 * Candidatos no empatados por debajo del bloque empatado reciben posición conservadora
 * (p. ej. C=3 cuando A/B empatan por 1.º).
 */
export function assignPositionsWithTies(
  ranked: Array<{ publicCode: string; value: number }>,
  tiedCodes: Set<string>,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  if (tiedCodes.size === 0) {
    ranked.forEach((r, i) => out.set(r.publicCode, i + 1));
    return out;
  }

  // Posición "ocupada" mínima por bloque empatado = startIndex+1
  let cursor = 1;
  let i = 0;
  while (i < ranked.length) {
    const code = ranked[i]!.publicCode;
    if (tiedCodes.has(code)) {
      // Bloque empatado: todos null; avanza cursor por el tamaño del bloque
      const v = ranked[i]!.value;
      let size = 0;
      while (i < ranked.length && nearlyEqual(ranked[i]!.value, v) && tiedCodes.has(ranked[i]!.publicCode)) {
        out.set(ranked[i]!.publicCode, null);
        size += 1;
        i += 1;
      }
      cursor += size;
      continue;
    }
    out.set(code, cursor);
    cursor += 1;
    i += 1;
  }
  return out;
}

export async function createFinalSnapshotForRound(input: {
  roundId: string;
  actorUserId?: number | null;
  positionsNeeded?: number;
}) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: input.roundId },
    include: { candidates: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!round) throw new PublicVoteError("ROUND_NOT_FOUND", "Ronda no encontrada.", 404);
  if (round.status === "CANCELLED") {
    throw new PublicVoteError("IMMUTABLE", "Ronda CANCELLED no admite snapshot.", 409);
  }
  if (round.status === "FINALIZED" && round.finalSnapshotHash) {
    const snaps = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
      where: { roundId: round.id },
      orderBy: { finalPosition: "asc" },
    });
    return { round, snapshots: snaps, tiePublicCodes: [] as string[], pending: false, idempotent: true };
  }
  if (round.status === "TIEBREAK_REQUIRED" && round.finalSnapshotHash) {
    const snaps = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
      where: { roundId: round.id },
      orderBy: { finalPosition: "asc" },
    });
    const tiePublicCodes = snaps.filter((s) => s.finalPosition == null).map((s) => s.publicCode);
    return { round, snapshots: snaps, tiePublicCodes, pending: false, idempotent: true };
  }

  const now = getPublicVoteNow();
  if (now.getTime() < round.endsAt.getTime()) {
    throw new PublicVoteError("INVALID_STATE", "Aún no llegó endsAt; no se puede finalizar.", 409);
  }

  const positionsNeeded = input.positionsNeeded ?? round.candidates.length;
  const metrics: CandMetric[] = [];
  for (const c of round.candidates) {
    const m = await resolveMetricForCandidate({
      roundId: round.id,
      candidateId: c.id,
      publicCode: c.publicCode,
      endsAt: round.endsAt,
      cutoffPolicy: round.cutoffPolicy as PublicVoteCutoffPolicy,
    });
    if (!m) {
      await prisma.fotorankPublicVoteRound.update({
        where: { id: round.id },
        data: { status: "PENDING_FINAL_SNAPSHOT", closedAt: round.closedAt ?? now },
      });
      await writePublicVoteAudit({
        contestId: round.contestId,
        actorUserId: input.actorUserId,
        eventType: "PUBLIC_VOTE_PENDING_FINAL_SNAPSHOT",
        entityType: "FotorankPublicVoteRound",
        entityId: round.id,
        payload: { missingPublicCode: c.publicCode },
      });
      return {
        round: await prisma.fotorankPublicVoteRound.findUniqueOrThrow({ where: { id: round.id } }),
        snapshots: [],
        tiePublicCodes: [],
        pending: true,
        idempotent: false,
      };
    }
    metrics.push(m);
  }

  // Idempotencia concurrente: si otro worker ya escribió, salir
  const existingCount = await prisma.fotorankPublicVoteFinalSnapshot.count({
    where: { roundId: round.id },
  });
  if (existingCount > 0 && round.finalSnapshotHash) {
    const snaps = await prisma.fotorankPublicVoteFinalSnapshot.findMany({
      where: { roundId: round.id },
    });
    return {
      round,
      snapshots: snaps,
      tiePublicCodes: snaps.filter((s) => s.finalPosition == null).map((s) => s.publicCode),
      pending: false,
      idempotent: true,
    };
  }

  await prisma.fotorankPublicVoteFinalSnapshot.deleteMany({ where: { roundId: round.id } });

  // Ranking: solo métrica pública (DESC). No jury score.
  const ranked = [...metrics].sort((a, b) => {
    if (!nearlyEqual(a.value, b.value)) return b.value - a.value;
    return a.publicCode.localeCompare(b.publicCode);
  });

  const tiePublicCodes = detectTieAffectingPositions(
    ranked.map((r) => ({ publicCode: r.publicCode, value: r.value })),
    positionsNeeded,
  );
  const tiedSet = new Set(tiePublicCodes);
  const positions = assignPositionsWithTies(
    ranked.map((r) => ({ publicCode: r.publicCode, value: r.value })),
    tiedSet,
  );

  const created = [];
  for (const row of ranked) {
    const integrityHash = candidateIntegrityHash({
      roundId: round.id,
      publicCode: row.publicCode,
      finalMetricValue: row.value,
      cutoffAt: round.endsAt,
      observationId: row.observationId,
    });
    created.push(
      await prisma.fotorankPublicVoteFinalSnapshot.create({
        data: {
          id: newId("pvf"),
          roundId: round.id,
          candidateId: row.candidateId,
          publicCode: row.publicCode,
          finalMetricValue: row.value,
          observationId: row.observationId,
          cutoffAt: round.endsAt,
          providerObservedAt: row.providerObservedAt,
          finalizedAt: now,
          finalPosition: positions.get(row.publicCode) ?? null,
          integrityHash,
          metadataJson: { engine: "public-vote-17a", juryScoreIgnored: true },
        },
      }),
    );
  }

  const finalHash = hashFinalSnapshot(
    created.map((s) => ({
      publicCode: s.publicCode,
      finalMetricValue: s.finalMetricValue,
      finalPosition: s.finalPosition,
    })),
  );

  const nextStatus = tiePublicCodes.length > 0 ? "TIEBREAK_REQUIRED" : "FINALIZED";
  const updated = await prisma.fotorankPublicVoteRound.update({
    where: { id: round.id },
    data: {
      status: nextStatus,
      closedAt: round.closedAt ?? now,
      finalSnapshotAt: now,
      finalSnapshotHash: finalHash,
      resultsPublicationStatus: "CALCULATED",
    },
  });

  await writePublicVoteAudit({
    contestId: round.contestId,
    actorUserId: input.actorUserId,
    eventType:
      nextStatus === "TIEBREAK_REQUIRED"
        ? "PUBLIC_VOTE_TIEBREAK_REQUIRED"
        : "PUBLIC_VOTE_FINAL_SNAPSHOT_CREATED",
    entityType: "FotorankPublicVoteRound",
    entityId: round.id,
    payload: {
      finalHash,
      tiePublicCodes,
      positionsNeeded,
      resultsPublicationStatus: "CALCULATED",
    },
  });

  if (nextStatus === "FINALIZED") {
    for (const snap of created) {
      if (snap.finalPosition == null) continue;
      const cand = round.candidates.find((c) => c.id === snap.candidateId);
      if (!cand?.finalistSnapshotId) continue;
      const finalist = await prisma.fotorankFinalistSnapshot.findUnique({
        where: { id: cand.finalistSnapshotId },
        select: { resultBatchId: true, juryEntrySnapshotId: true, promptExternalId: true },
      });
      if (!finalist?.resultBatchId) continue;
      await prisma.fotorankResultEntry.updateMany({
        where: {
          resultBatchId: finalist.resultBatchId,
          juryEntrySnapshotId: finalist.juryEntrySnapshotId,
          scopeKey: `PROMPT:${finalist.promptExternalId}`,
        },
        data: {
          finalPosition: snap.finalPosition,
          resultStatus: snap.finalPosition === 1 ? "WINNER" : "FINALIST",
        },
      });
    }
    await writePublicVoteAudit({
      contestId: round.contestId,
      actorUserId: input.actorUserId,
      eventType: "PUBLIC_VOTE_FINALIZED",
      entityType: "FotorankPublicVoteRound",
      entityId: round.id,
      payload: { published: false, resultsPublicationStatus: "CALCULATED" },
    });
  }

  return {
    round: updated,
    snapshots: created,
    tiePublicCodes,
    pending: false,
    idempotent: false,
  };
}
