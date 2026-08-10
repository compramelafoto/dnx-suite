/**
 * ETAPA 16A — Distribución automática de evaluaciones de jurado (§6 master rules).
 * FotoRank distribuye automáticamente; el organizador no asigna manualmente.
 * Solo corre después de: batch de admisión FROZEN + elegibilidad competitiva congelada
 * (cuando el concurso la requiere). No reasigna la misma obra dos veces al mismo jurado.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { getOrCreateCompetitionJuryConfig } from "./competition-jury-config";
import { listJuryEligibleParticipantIds } from "./competitive-eligibility-service";

function newId() {
  return `je${randomBytes(12).toString("hex")}`;
}

type AssignmentRow = {
  id: string;
  judgeAccountId: string;
  categoryId: string;
};

export type DistributeJuryEvaluationsResult = {
  requiredEvaluationsPerEntry: number;
  totalSnapshots: number;
  eligibleSnapshots: number;
  createdEvaluations: number;
  snapshotsFullyCovered: number;
  snapshotsWithIncompleteCoverage: number;
};

/**
 * Asegura `requiredEvaluationsPerEntry` evaluaciones NOT_STARTED por snapshot elegible,
 * repartidas entre jurados ACCEPTED de la categoría, balanceando carga y respetando conflictos.
 */
export async function distributeJuryEvaluations(input: {
  contestId: string;
  scoringSessionId: string;
  actorUserId: number;
}): Promise<DistributeJuryEvaluationsResult> {
  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { id: input.scoringSessionId, contestId: input.contestId },
    include: { admissionBatch: true, rubric: { select: { id: true, version: true } } },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión no encontrada.", 404);
  if (session.admissionBatch.status !== "FROZEN") {
    throw new JuryError("BATCH_NOT_FROZEN", "El lote de admisión no está congelado.", 409);
  }

  const config = await getOrCreateCompetitionJuryConfig(input.contestId);
  const requiredEvaluationsPerEntry = config.requiredEvaluationsPerEntry;

  let eligibleParticipantIds: Set<string> | null = null;
  if (config.minimumValidEntriesForCompetition != null) {
    const freeze = await prisma.fotorankCompetitiveEligibilityFreeze.findFirst({
      where: {
        contestId: input.contestId,
        status: "ELIGIBILITY_FROZEN",
        admissionBatchId: session.admissionBatchId,
      },
      orderBy: { configVersion: "desc" },
    });
    if (!freeze) {
      throw new JuryError(
        "BATCH_NOT_FROZEN",
        "La elegibilidad competitiva no está congelada para este lote.",
        409,
      );
    }
    eligibleParticipantIds = new Set(await listJuryEligibleParticipantIds(input.contestId));
  }

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
    include: { entry: { select: { externalRegistrationId: true } } },
  });

  let participantByRegistration: Map<string, string> | null = null;
  if (eligibleParticipantIds) {
    const participants = await prisma.fotorankContestParticipant.findMany({
      where: { contestId: input.contestId },
      select: { id: true, externalRegistrationId: true },
    });
    participantByRegistration = new Map(
      participants
        .filter((p): p is { id: string; externalRegistrationId: string } => Boolean(p.externalRegistrationId))
        .map((p) => [p.externalRegistrationId, p.id]),
    );
  }

  const eligibleSnapshots = eligibleParticipantIds
    ? snapshots.filter((s) => {
        const participantId =
          s.participantId ??
          (s.entry.externalRegistrationId
            ? participantByRegistration?.get(s.entry.externalRegistrationId)
            : null);
        return participantId ? eligibleParticipantIds!.has(participantId) : false;
      })
    : snapshots;

  const assignments = (await prisma.fotorankJudgeAssignment.findMany({
    where: { contestId: input.contestId, assignmentStatus: "ACCEPTED" },
    select: { id: true, judgeAccountId: true, categoryId: true },
  })) as AssignmentRow[];
  const assignmentsByCategory = new Map<string, AssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByCategory.get(a.categoryId) ?? [];
    arr.push(a);
    assignmentsByCategory.set(a.categoryId, arr);
  }

  const conflicts = await prisma.fotorankJudgeEntryConflict.findMany({
    where: { contestId: input.contestId, status: "ACTIVE" },
    select: { entryId: true, judgeAccountId: true },
  });
  const conflictSet = new Set(conflicts.map((c) => `${c.entryId}:${c.judgeAccountId}`));

  const existingEvals = await prisma.fotorankJuryEvaluation.findMany({
    where: { admissionBatchId: session.admissionBatchId, status: { not: "VOIDED" } },
    select: { juryEntrySnapshotId: true, jurorId: true },
  });
  const assignedJurorsBySnapshot = new Map<string, Set<string>>();
  const loadByJudge = new Map<string, number>();
  for (const e of existingEvals) {
    const set = assignedJurorsBySnapshot.get(e.juryEntrySnapshotId) ?? new Set<string>();
    set.add(e.jurorId);
    assignedJurorsBySnapshot.set(e.juryEntrySnapshotId, set);
    loadByJudge.set(e.jurorId, (loadByJudge.get(e.jurorId) ?? 0) + 1);
  }

  // Orden determinístico; agrupar por consigna favorece variedad de coverage sin ser regla dura.
  const sortedSnapshots = [...eligibleSnapshots].sort((a, b) => {
    const pa = a.promptExternalId ?? "";
    const pb = b.promptExternalId ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    return a.anonymousCode.localeCompare(b.anonymousCode);
  });

  let createdEvaluations = 0;
  let snapshotsFullyCovered = 0;
  let snapshotsWithIncompleteCoverage = 0;

  for (const snap of sortedSnapshots) {
    const categoryAssignments = assignmentsByCategory.get(snap.categoryId) ?? [];
    const already = assignedJurorsBySnapshot.get(snap.id) ?? new Set<string>();
    const needed = requiredEvaluationsPerEntry - already.size;

    if (needed <= 0) {
      snapshotsFullyCovered += 1;
      continue;
    }
    if (categoryAssignments.length === 0) {
      snapshotsWithIncompleteCoverage += 1;
      continue;
    }

    const candidates = categoryAssignments.filter(
      (a) => !already.has(a.judgeAccountId) && !conflictSet.has(`${snap.entryId}:${a.judgeAccountId}`),
    );
    candidates.sort((a, b) => (loadByJudge.get(a.judgeAccountId) ?? 0) - (loadByJudge.get(b.judgeAccountId) ?? 0));

    const picked = candidates.slice(0, needed);
    for (const assignment of picked) {
      await prisma.fotorankJuryEvaluation.upsert({
        where: {
          assignmentId_juryEntrySnapshotId: {
            assignmentId: assignment.id,
            juryEntrySnapshotId: snap.id,
          },
        },
        create: {
          id: newId(),
          contestId: input.contestId,
          admissionBatchId: session.admissionBatchId,
          scoringSessionId: session.id,
          juryEntrySnapshotId: snap.id,
          assignmentId: assignment.id,
          jurorId: assignment.judgeAccountId,
          rubricId: session.rubricId,
          rubricVersion: session.rubric.version,
          status: "NOT_STARTED",
        },
        update: {},
      });
      already.add(assignment.judgeAccountId);
      loadByJudge.set(assignment.judgeAccountId, (loadByJudge.get(assignment.judgeAccountId) ?? 0) + 1);
      createdEvaluations += 1;
    }
    assignedJurorsBySnapshot.set(snap.id, already);

    if (already.size >= requiredEvaluationsPerEntry) {
      snapshotsFullyCovered += 1;
    } else {
      snapshotsWithIncompleteCoverage += 1;
    }
  }

  if (createdEvaluations > 0) {
    await prisma.fotorankJuryScoringSession.update({
      where: { id: session.id },
      data: { assignmentsCount: { increment: createdEvaluations } },
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
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: "JURY_AUTO_DISTRIBUTION_RUN",
      entityType: "FotorankJuryScoringSession",
      entityId: session.id,
      payloadJson: {
        totalSnapshots: snapshots.length,
        eligibleSnapshots: eligibleSnapshots.length,
        createdEvaluations,
        snapshotsFullyCovered,
        snapshotsWithIncompleteCoverage,
        requiredEvaluationsPerEntry,
      },
    },
  });

  return {
    requiredEvaluationsPerEntry,
    totalSnapshots: snapshots.length,
    eligibleSnapshots: eligibleSnapshots.length,
    createdEvaluations,
    snapshotsFullyCovered,
    snapshotsWithIncompleteCoverage,
  };
}
