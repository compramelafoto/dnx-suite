/**
 * ETAPA 16A — Confirmación de bloque/consigna (§7.5–7.6 master rules).
 * "CONFIRMAR EVALUACIÓN" solo si: todas completas, criterios/foto completos,
 * 0 postergadas, 0 pendientes → LOCKED. Confirmación por consigna/bloque.
 */
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJudgeContestAccess } from "./jury-access";

export type ConfirmJudgeEvaluationBlockResult = {
  blockScope: string;
  confirmedCount: number;
  totalInBlock: number;
};

export async function confirmJudgeEvaluationBlock(input: {
  judgeAccountId: string;
  contestId: string;
  promptExternalId?: string | null;
}): Promise<ConfirmJudgeEvaluationBlockResult> {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN", scoringEnabled: true },
    include: { rubric: { include: { criteria: true } } },
    orderBy: { openedAt: "desc" },
  });
  if (!session) {
    throw new JuryError("SESSION_CLOSED", "No hay sesión de jurado OPEN habilitada.", 403);
  }

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: {
      admissionBatchId: session.admissionBatchId,
      categoryId: { in: access.categoryIds },
      ...(input.promptExternalId ? { promptExternalId: input.promptExternalId } : {}),
    },
    select: { id: true, entryId: true },
  });
  if (snapshots.length === 0) {
    throw new JuryError("NOT_FOUND", "No hay obras asignadas en este bloque.", 404);
  }
  const snapshotIds = snapshots.map((s) => s.id);

  const conflicts = await prisma.fotorankJudgeEntryConflict.findMany({
    where: {
      contestId: input.contestId,
      judgeAccountId: input.judgeAccountId,
      status: "ACTIVE",
      entryId: { in: snapshots.map((s) => s.entryId) },
    },
    select: { entryId: true },
  });
  const conflictEntryIds = new Set(conflicts.map((c) => c.entryId));
  const applicableSnapshotIds = snapshots
    .filter((s) => !conflictEntryIds.has(s.entryId))
    .map((s) => s.id);

  const evaluations = await prisma.fotorankJuryEvaluation.findMany({
    where: {
      jurorId: input.judgeAccountId,
      juryEntrySnapshotId: { in: applicableSnapshotIds },
      scoringSessionId: session.id,
    },
    include: { criterionScores: true },
  });
  const evalBySnapshot = new Map(evaluations.map((e) => [e.juryEntrySnapshotId, e]));

  const requiredCriteriaCount = session.rubric.criteria.filter((c) => c.required).length;

  const postponed = evaluations.filter((e) => e.status === "POSTPONED");
  if (postponed.length > 0) {
    throw new JuryError(
      "COVERAGE_INCOMPLETE",
      `Hay ${postponed.length} evaluación(es) postergada(s). Revisalas antes de confirmar.`,
      409,
    );
  }

  const incompleteSnapshotIds = applicableSnapshotIds.filter((snapshotId) => {
    const evaluation = evalBySnapshot.get(snapshotId);
    if (!evaluation) return true;
    if (evaluation.status !== "SUBMITTED" && evaluation.status !== "LOCKED") return true;
    if (requiredCriteriaCount > 0 && evaluation.criterionScores.length < requiredCriteriaCount) return true;
    return false;
  });
  if (incompleteSnapshotIds.length > 0) {
    throw new JuryError(
      "COVERAGE_INCOMPLETE",
      `Hay ${incompleteSnapshotIds.length} obra(s) sin evaluación completa en este bloque.`,
      409,
    );
  }

  const now = new Date();
  const toLock = evaluations.filter((e) => e.status === "SUBMITTED");
  if (toLock.length > 0) {
    await prisma.fotorankJuryEvaluation.updateMany({
      where: { id: { in: toLock.map((e) => e.id) } },
      data: { status: "LOCKED", confirmedBlockAt: now },
    });
  }
  const alreadyLocked = evaluations.filter((e) => e.status === "LOCKED" && !e.confirmedBlockAt);
  if (alreadyLocked.length > 0) {
    await prisma.fotorankJuryEvaluation.updateMany({
      where: { id: { in: alreadyLocked.map((e) => e.id) } },
      data: { confirmedBlockAt: now },
    });
  }

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "JUDGE",
      actorJudgeId: input.judgeAccountId,
      eventType: "JURY_EVALUATION_BLOCK_CONFIRMED",
      entityType: "FotorankJuryEvaluation",
      entityId: session.id,
      payloadJson: {
        blockScope: input.promptExternalId ?? "ALL",
        confirmedCount: toLock.length + alreadyLocked.length,
        totalInBlock: applicableSnapshotIds.length,
      },
    },
  });

  return {
    blockScope: input.promptExternalId ?? "ALL",
    confirmedCount: toLock.length + alreadyLocked.length,
    totalInBlock: applicableSnapshotIds.length,
  };
}
