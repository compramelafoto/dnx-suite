/**
 * ETAPA 16A — Desempate con jurado adicional (§5.1 master rules).
 * "Evaluación de desempate por un jurado adicional que aún no evaluó esa foto.
 * No reconvocar a todos. Auditado."
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";

function newId() {
  return `je${randomBytes(12).toString("hex")}`;
}

async function requireOrganizerMembership(contestId: string, actorUserId: number) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, organizationId: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  const member = await prisma.contestOrganizationMember.findFirst({
    where: { organizationId: contest.organizationId, userId: actorUserId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!member) throw new JuryError("FORBIDDEN", "Sin permisos de organizador.", 403);
  return contest;
}

export type TiebreakAssignmentOutcome =
  | { snapshotId: string; assigned: true; assignmentId: string; judgeAccountId: string; evaluationId: string }
  | { snapshotId: string; assigned: false; reason: "NO_ELIGIBLE_JUDGE" | "SNAPSHOT_NOT_FOUND" };

export async function requestExtraJudgeTiebreak(input: {
  contestId: string;
  snapshotIds: string[];
  actorUserId: number;
}): Promise<{ results: TiebreakAssignmentOutcome[]; assignedCount: number; skippedCount: number }> {
  if (input.snapshotIds.length === 0) {
    throw new JuryError("INVALID_INPUT", "snapshotIds no puede estar vacío.", 400);
  }
  const contest = await requireOrganizerMembership(input.contestId, input.actorUserId);

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { id: { in: input.snapshotIds }, contestId: input.contestId },
    select: { id: true, entryId: true, categoryId: true, admissionBatchId: true },
  });
  const snapshotById = new Map(snapshots.map((s) => [s.id, s]));

  const conflicts = await prisma.fotorankJudgeEntryConflict.findMany({
    where: {
      contestId: input.contestId,
      status: "ACTIVE",
      entryId: { in: snapshots.map((s) => s.entryId) },
    },
    select: { entryId: true, judgeAccountId: true },
  });
  const conflictSet = new Set(conflicts.map((c) => `${c.entryId}:${c.judgeAccountId}`));

  const existingEvals = await prisma.fotorankJuryEvaluation.findMany({
    where: { juryEntrySnapshotId: { in: input.snapshotIds }, status: { not: "VOIDED" } },
    select: { juryEntrySnapshotId: true, jurorId: true },
  });
  const evaluatedBySnapshot = new Map<string, Set<string>>();
  for (const e of existingEvals) {
    const set = evaluatedBySnapshot.get(e.juryEntrySnapshotId) ?? new Set<string>();
    set.add(e.jurorId);
    evaluatedBySnapshot.set(e.juryEntrySnapshotId, set);
  }

  const results: TiebreakAssignmentOutcome[] = [];

  for (const snapshotId of input.snapshotIds) {
    const snapshot = snapshotById.get(snapshotId);
    if (!snapshot) {
      results.push({ snapshotId, assigned: false, reason: "SNAPSHOT_NOT_FOUND" });
      continue;
    }

    const alreadyEvaluatedBy = evaluatedBySnapshot.get(snapshotId) ?? new Set<string>();
    const candidateAssignments = await prisma.fotorankJudgeAssignment.findMany({
      where: {
        contestId: input.contestId,
        categoryId: snapshot.categoryId,
        assignmentStatus: "ACCEPTED",
        judgeAccountId: { notIn: [...alreadyEvaluatedBy] },
      },
      select: { id: true, judgeAccountId: true },
      orderBy: { createdAt: "asc" },
    });
    const eligible = candidateAssignments.filter(
      (a) => !conflictSet.has(`${snapshot.entryId}:${a.judgeAccountId}`),
    );

    if (eligible.length === 0) {
      results.push({ snapshotId, assigned: false, reason: "NO_ELIGIBLE_JUDGE" });
      continue;
    }

    const chosen = eligible[0]!;
    const rubric = await prisma.fotorankJuryRubric.findFirst({
      where: { contestId: input.contestId, admissionBatchId: snapshot.admissionBatchId, status: "ACTIVE" },
      select: { id: true, version: true },
    });
    if (!rubric) {
      results.push({ snapshotId, assigned: false, reason: "NO_ELIGIBLE_JUDGE" });
      continue;
    }
    const session = await prisma.fotorankJuryScoringSession.findFirst({
      where: { contestId: input.contestId, admissionBatchId: snapshot.admissionBatchId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const evaluation = await prisma.fotorankJuryEvaluation.upsert({
      where: {
        assignmentId_juryEntrySnapshotId: { assignmentId: chosen.id, juryEntrySnapshotId: snapshotId },
      },
      create: {
        id: newId(),
        contestId: input.contestId,
        admissionBatchId: snapshot.admissionBatchId,
        scoringSessionId: session?.id ?? null,
        juryEntrySnapshotId: snapshotId,
        assignmentId: chosen.id,
        jurorId: chosen.judgeAccountId,
        rubricId: rubric.id,
        rubricVersion: rubric.version,
        status: "NOT_STARTED",
      },
      update: {},
    });

    alreadyEvaluatedBy.add(chosen.judgeAccountId);
    evaluatedBySnapshot.set(snapshotId, alreadyEvaluatedBy);

    results.push({
      snapshotId,
      assigned: true,
      assignmentId: chosen.id,
      judgeAccountId: chosen.judgeAccountId,
      evaluationId: evaluation.id,
    });
  }

  const assignedCount = results.filter((r) => r.assigned).length;
  const skippedCount = results.length - assignedCount;

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: "JURY_TIEBREAK_EXTRA_JUDGE_REQUESTED",
      entityType: "FotorankJuryEntrySnapshot",
      entityId: input.snapshotIds[0]!,
      payloadJson: {
        snapshotIds: input.snapshotIds,
        assignedCount,
        skippedCount,
        results,
      },
    },
  });

  return { results, assignedCount, skippedCount };
}
