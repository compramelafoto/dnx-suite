/**
 * ETAPA 16A — Ranking provisional para organizador (§7.8 master rules).
 * "Organizador: puede ver ranking provisional con banner RESULTADO PROVISORIO —
 * EVALUACIÓN INCOMPLETA. No edita notas." El jurado NUNCA debe poder llamar esto;
 * el control de permisos (canViewJuryProgress / canViewAggregatedScores) vive en la capa API.
 */
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { computePrivateAggregates } from "./scoring-engine";

export const PROVISIONAL_RESULT_BANNER = "RESULTADO PROVISORIO — EVALUACIÓN INCOMPLETA";

export type ProvisionalRankingRow = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  evaluationCount: number;
  requiredEvaluations: number;
  coveragePercent: number;
  coverageComplete: boolean;
  averageScore: number | null;
  normalizedAverage: number | null;
};

export type OrganizerProvisionalRanking = {
  scoringSessionId: string;
  sessionStatus: string;
  banner: string | null;
  overallCoveragePercent: number;
  overallComplete: boolean;
  rows: ProvisionalRankingRow[];
};

export async function getOrganizerProvisionalRanking(input: {
  contestId: string;
  scoringSessionId?: string;
}): Promise<OrganizerProvisionalRanking> {
  const session = input.scoringSessionId
    ? await prisma.fotorankJuryScoringSession.findFirst({
        where: { id: input.scoringSessionId, contestId: input.contestId },
      })
    : await prisma.fotorankJuryScoringSession.findFirst({
        where: { contestId: input.contestId },
        orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
      });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión de jurado no encontrada.", 404);

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
    select: { id: true, anonymousCode: true, categoryId: true, promptExternalId: true },
  });

  const evaluations = await prisma.fotorankJuryEvaluation.findMany({
    where: {
      scoringSessionId: session.id,
      status: { in: ["SUBMITTED", "LOCKED"] },
    },
    select: { juryEntrySnapshotId: true, totalScore: true, normalizedScore: true },
  });
  const evalsBySnapshot = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const arr = evalsBySnapshot.get(e.juryEntrySnapshotId) ?? [];
    arr.push(e);
    evalsBySnapshot.set(e.juryEntrySnapshotId, arr);
  }

  const required = Math.max(1, session.minimumEvaluationsPerEntry);
  let completeCount = 0;

  const rows: ProvisionalRankingRow[] = snapshots.map((snap) => {
    const evals = evalsBySnapshot.get(snap.id) ?? [];
    const totals = evals
      .map((e) => e.totalScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const norms = evals
      .map((e) => e.normalizedScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const agg = computePrivateAggregates(totals);
    const normAgg = computePrivateAggregates(norms);
    const coveragePercent = Math.min(100, Math.round((evals.length / required) * 100));
    const coverageComplete = evals.length >= required;
    if (coverageComplete) completeCount += 1;

    return {
      snapshotId: snap.id,
      anonymousCode: snap.anonymousCode,
      categoryId: snap.categoryId,
      promptExternalId: snap.promptExternalId,
      evaluationCount: evals.length,
      requiredEvaluations: required,
      coveragePercent,
      coverageComplete,
      averageScore: agg.average,
      normalizedAverage: normAgg.average,
    };
  });

  rows.sort((a, b) => {
    const av = a.normalizedAverage ?? -Infinity;
    const bv = b.normalizedAverage ?? -Infinity;
    return bv - av;
  });

  const overallComplete = snapshots.length > 0 && completeCount === snapshots.length;
  const overallCoveragePercent =
    snapshots.length > 0 ? Math.round((completeCount / snapshots.length) * 100) : 0;

  return {
    scoringSessionId: session.id,
    sessionStatus: session.status,
    banner: overallComplete ? null : PROVISIONAL_RESULT_BANNER,
    overallCoveragePercent,
    overallComplete,
    rows,
  };
}
