/**
 * Revisión de conflicto + reasignación (organizador).
 * No revela identidad del autor. Idempotente por conflictId+toJudge.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { enqueueJuryNotificationIntent } from "./notification-intents";

function newId(prefix = "asg") {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

async function requireOrganizerMembership(contestId: string, actorUserId: number) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, organizationId: true, slug: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId: actorUserId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!member) throw new JuryError("FORBIDDEN", "Sin permisos de organizador.", 403);
  return contest;
}

/**
 * Acepta conflicto ACTIVE y reasigna la obra a otro jurado de la misma categoría.
 */
export async function acceptConflictAndReassign(input: {
  contestId: string;
  conflictId: string;
  toJudgeAccountId: string;
  actorUserId: number;
  reason?: string | null;
  idempotencyKey?: string | null;
}) {
  const contest = await requireOrganizerMembership(input.contestId, input.actorUserId);

  if (input.idempotencyKey) {
    const prior = await prisma.fotorankJudgeAuditEvent.findFirst({
      where: {
        contestId: input.contestId,
        eventType: "JURY_CONFLICT_REASSIGNED",
        payloadJson: { path: ["idempotencyKey"], equals: input.idempotencyKey },
      },
      select: { entityId: true, payloadJson: true },
    });
    if (prior) {
      return {
        conflictId: prior.entityId,
        idempotent: true as const,
        assignmentId:
          (prior.payloadJson as { assignmentId?: string } | null)?.assignmentId ?? null,
      };
    }
  }

  const conflict = await prisma.fotorankJudgeEntryConflict.findFirst({
    where: { id: input.conflictId, contestId: input.contestId },
    include: {
      entry: { select: { id: true, categoryId: true, contestId: true } },
    },
  });
  if (!conflict) throw new JuryError("NOT_FOUND", "Conflicto no encontrado.", 404);

  if (conflict.status === "REVIEWED") {
    return {
      conflictId: conflict.id,
      idempotent: true as const,
      assignmentId: null,
      alreadyReviewed: true as const,
    };
  }
  if (conflict.status !== "ACTIVE") {
    throw new JuryError("INVALID_INPUT", "El conflicto no está ACTIVE.", 409);
  }

  if (input.toJudgeAccountId === conflict.judgeAccountId) {
    throw new JuryError(
      "INVALID_INPUT",
      "No se puede reasignar al mismo jurado en conflicto.",
      400,
    );
  }

  const targetJudge = await prisma.fotorankJudgeAccount.findFirst({
    where: { id: input.toJudgeAccountId, accountStatus: "ACTIVE" },
    select: { id: true },
  });
  if (!targetJudge) {
    throw new JuryError("INVALID_INPUT", "Jurado destino inexistente o revocado.", 400);
  }

  let targetAssignment = await prisma.fotorankJudgeAssignment.findFirst({
    where: {
      contestId: input.contestId,
      categoryId: conflict.entry.categoryId,
      judgeAccountId: input.toJudgeAccountId,
      assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "EXTENDED", "ASSIGNED"] },
    },
  });

  if (!targetAssignment) {
    // Crear assignment BACKUP explícito (misma categoría / concurso).
    const template = await prisma.fotorankJudgeAssignment.findFirst({
      where: {
        contestId: input.contestId,
        categoryId: conflict.entry.categoryId,
        assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "ASSIGNED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!template) {
      throw new JuryError(
        "CATEGORY_NOT_ASSIGNED",
        "No hay plantilla de asignación en la categoría.",
        409,
      );
    }
    targetAssignment = await prisma.fotorankJudgeAssignment.create({
      data: {
        id: newId(),
        judgeAccountId: input.toJudgeAccountId,
        organizationId: contest.organizationId,
        contestId: input.contestId,
        categoryId: conflict.entry.categoryId,
        assignmentType: "BACKUP",
        assignmentStatus: "ACCEPTED",
        methodType: template.methodType,
        methodConfigJson: template.methodConfigJson ?? {},
        allowVoteEdit: false,
        commentsVisibleToParticipants: false,
        createdByUserId: input.actorUserId,
        admissionBatchId: template.admissionBatchId,
      },
    });
  }

  // Invalidar drafts del jurado en conflicto sobre esta obra (no tocar SUBMITTED/LOCKED).
  const snaps = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { contestId: input.contestId, entryId: conflict.entryId },
    select: { id: true },
  });
  if (snaps.length) {
    await prisma.fotorankJuryEvaluation.updateMany({
      where: {
        contestId: input.contestId,
        jurorId: conflict.judgeAccountId,
        juryEntrySnapshotId: { in: snaps.map((s) => s.id) },
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason: "CONFLICT_REASSIGNED",
        totalScore: null,
        normalizedScore: null,
      },
    });
  }

  const reviewed = await prisma.fotorankJudgeEntryConflict.update({
    where: { id: conflict.id },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId,
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: "JURY_CONFLICT_REASSIGNED",
      entityType: "FotorankJudgeEntryConflict",
      entityId: reviewed.id,
      payloadJson: {
        entryId: conflict.entryId,
        fromJudgeAccountId: conflict.judgeAccountId,
        toJudgeAccountId: input.toJudgeAccountId,
        assignmentId: targetAssignment.id,
        reason: input.reason ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        // sin PII / autor
      },
    },
  });

  await enqueueJuryNotificationIntent({
    contestId: input.contestId,
    kind: "JURY_CONFLICT_REASSIGNED",
    toJudgeAccountId: input.toJudgeAccountId,
    assignmentId: targetAssignment.id,
    metadata: { conflictId: reviewed.id, entryId: conflict.entryId },
  });

  return {
    conflictId: reviewed.id,
    assignmentId: targetAssignment.id,
    idempotent: false as const,
  };
}

export async function dismissJuryConflict(input: {
  contestId: string;
  conflictId: string;
  actorUserId: number;
  reason?: string | null;
}) {
  await requireOrganizerMembership(input.contestId, input.actorUserId);
  const conflict = await prisma.fotorankJudgeEntryConflict.findFirst({
    where: { id: input.conflictId, contestId: input.contestId },
  });
  if (!conflict) throw new JuryError("NOT_FOUND", "Conflicto no encontrado.", 404);
  if (conflict.status !== "ACTIVE") {
    return { conflictId: conflict.id, idempotent: true as const };
  }
  const updated = await prisma.fotorankJudgeEntryConflict.update({
    where: { id: conflict.id },
    data: {
      status: "DISMISSED",
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId,
    },
  });
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
      eventType: "JURY_CONFLICT_DISMISSED",
      entityType: "FotorankJudgeEntryConflict",
      entityId: updated.id,
      payloadJson: { reason: input.reason ?? null },
    },
  });
  return { conflictId: updated.id, idempotent: false as const };
}

/** Cobertura válida: solo SUBMITTED/LOCKED; excluye VOID/abstain/conflicto. */
export function countValidEvaluationsForCoverage(
  statuses: Array<"SUBMITTED" | "LOCKED" | "VOIDED" | "IN_PROGRESS" | "NOT_STARTED">,
): number {
  return statuses.filter((s) => s === "SUBMITTED" || s === "LOCKED").length;
}
