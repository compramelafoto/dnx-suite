import { prisma } from "@repo/db";
import type { FotorankJudgeMethodType } from "@repo/db";
import { validateMethodConfig } from "./contracts";
import { DEFAULT_CRITERIA_BASED_METHOD_CONFIG } from "./criteriaBased";

const CONTEST_BLOCKED_FOR_INVITES: Array<"CLOSED" | "ARCHIVED"> = ["CLOSED", "ARCHIVED"];

export async function expireStaleDirectoryInvitationsNow(): Promise<void> {
  const now = new Date();
  await prisma.fotorankJudgeDirectoryInvitation.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
      respondedAt: now,
    },
  });
}

export async function assertNoDuplicateActiveDirectoryInvite(contestId: string, judgeAccountId: string): Promise<boolean> {
  const existing = await prisma.fotorankJudgeDirectoryInvitation.findFirst({
    where: {
      contestId,
      judgeAccountId,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: { id: true },
  });
  return !existing;
}

export function normalizeMethodConfig(methodType: FotorankJudgeMethodType, methodConfigJson: unknown): unknown {
  let cfg = methodConfigJson ?? {};
  if (methodType === "CRITERIA_BASED") {
    const raw = cfg as Record<string, unknown>;
    const criteria = Array.isArray(raw.criteria) ? raw.criteria : [];
    if (criteria.length === 0) cfg = DEFAULT_CRITERIA_BASED_METHOD_CONFIG;
  }
  return cfg;
}

export async function createDirectoryInvitationTx(params: {
  organizationId: string;
  contestId: string;
  judgeAccountId: string;
  sentByUserId: number;
  message: string;
  proposedRoleLabel: string | null;
  compensationOfferedText: string | null;
  organizerAcceptedExternalPaymentDisclaimer: boolean;
  categoryIds: string[];
  methodType: FotorankJudgeMethodType;
  methodConfigJson: unknown;
  assignmentType: "PRIMARY" | "BACKUP";
  expiresInDays?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!params.organizerAcceptedExternalPaymentDisclaimer) {
    return { ok: false, error: "Debés aceptar la aclaración sobre pagos externos." };
  }
  const message = params.message?.trim();
  if (!message || message.length < 3) {
    return { ok: false, error: "Escribí un mensaje para el jurado." };
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: params.contestId, organizationId: params.organizationId },
    select: { id: true, status: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };
  if (CONTEST_BLOCKED_FOR_INVITES.includes(contest.status as "CLOSED" | "ARCHIVED")) {
    return { ok: false, error: "Este concurso no admite nuevas invitaciones de jurado." };
  }

  const judgeListed = await prisma.fotorankJudgeProfile.findFirst({
    where: {
      judgeAccountId: params.judgeAccountId,
      isListedInProfessionalDirectory: true,
      judgeAccount: { accountStatus: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!judgeListed) return { ok: false, error: "Este jurado no está disponible en el directorio." };

  const dup = await assertNoDuplicateActiveDirectoryInvite(params.contestId, params.judgeAccountId);
  if (!dup) {
    return { ok: false, error: "Ya existe una invitación pendiente o aceptada para este jurado en el concurso." };
  }

  const categoryIds = [...new Set(params.categoryIds.map((id) => id.trim()).filter(Boolean))];
  if (categoryIds.length === 0) return { ok: false, error: "Seleccioná al menos una categoría." };

  const validCats = await prisma.fotorankContestCategory.findMany({
    where: { contestId: contest.id, id: { in: categoryIds }, status: "ACTIVE" },
    select: { id: true },
  });
  if (validCats.length !== categoryIds.length) {
    return { ok: false, error: "Una o más categorías no son válidas para el concurso." };
  }

  const methodConfigJson = normalizeMethodConfig(params.methodType, params.methodConfigJson);
  const check = validateMethodConfig(params.methodType as import("./contracts").JudgeMethodType, methodConfigJson);
  if (!check.valid) return { ok: false, error: check.error };

  const days = Math.max(1, Math.min(params.expiresInDays ?? 21, 90));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const row = await prisma.fotorankJudgeDirectoryInvitation.create({
    data: {
      organizationId: params.organizationId,
      contestId: contest.id,
      judgeAccountId: params.judgeAccountId,
      sentByUserId: params.sentByUserId,
      status: "PENDING",
      message,
      proposedRoleLabel: params.proposedRoleLabel?.trim() || null,
      compensationOfferedText: params.compensationOfferedText?.trim() || null,
      organizerAcceptedExternalPaymentDisclaimer: true,
      categoryIdsJson: categoryIds,
      methodType: params.methodType,
      methodConfigJson: methodConfigJson as object,
      assignmentType: params.assignmentType,
      expiresAt,
    },
  });

  return { ok: true, id: row.id };
}

export async function acceptDirectoryInvitationForJudge(params: {
  judgeAccountId: string;
  invitationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await expireStaleDirectoryInvitationsNow();

  const inv = await prisma.fotorankJudgeDirectoryInvitation.findFirst({
    where: { id: params.invitationId, judgeAccountId: params.judgeAccountId },
  });
  if (!inv) return { ok: false, error: "Invitación no encontrada." };
  if (inv.status === "EXPIRED" || (inv.expiresAt && inv.expiresAt < new Date())) {
    await prisma.fotorankJudgeDirectoryInvitation.update({
      where: { id: inv.id },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
    return { ok: false, error: "La invitación expiró." };
  }
  if (inv.status !== "PENDING") return { ok: false, error: "La invitación ya fue respondida." };

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: inv.contestId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };
  if (CONTEST_BLOCKED_FOR_INVITES.includes(contest.status as "CLOSED" | "ARCHIVED")) {
    return { ok: false, error: "El concurso ya no admite esta invitación." };
  }

  const categoryIds = Array.isArray(inv.categoryIdsJson)
    ? (inv.categoryIdsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (categoryIds.length === 0) return { ok: false, error: "La invitación no tiene categorías válidas." };

  const methodConfigJson = normalizeMethodConfig(inv.methodType, inv.methodConfigJson);
  const check = validateMethodConfig(inv.methodType as import("./contracts").JudgeMethodType, methodConfigJson);
  if (!check.valid) return { ok: false, error: check.error };

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.fotorankJudgeOrganizationMembership.upsert({
      where: {
        judgeAccountId_organizationId: {
          judgeAccountId: params.judgeAccountId,
          organizationId: contest.organizationId,
        },
      },
      create: {
        judgeAccountId: params.judgeAccountId,
        organizationId: contest.organizationId,
        membershipStatus: "ACTIVE",
      },
      update: { membershipStatus: "ACTIVE" },
    });

    const existing = await tx.fotorankJudgeAssignment.findMany({
      where: {
        judgeAccountId: params.judgeAccountId,
        contestId: contest.id,
        categoryId: { in: categoryIds },
      },
      select: { categoryId: true },
    });
    const existingSet = new Set(existing.map((e) => e.categoryId));
    const toCreate = categoryIds.filter((id) => !existingSet.has(id));

    for (const categoryId of toCreate) {
      await tx.fotorankJudgeAssignment.create({
        data: {
          judgeAccountId: params.judgeAccountId,
          organizationId: contest.organizationId,
          contestId: contest.id,
          categoryId,
          assignmentType: inv.assignmentType,
          assignmentStatus: "ACCEPTED",
          methodType: inv.methodType,
          methodConfigJson: methodConfigJson as object,
          allowVoteEdit: true,
          commentsVisibleToParticipants: false,
          createdByUserId: inv.sentByUserId,
        },
      });
    }

    await tx.fotorankJudgeDirectoryInvitation.update({
      where: { id: inv.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
        respondedAt: now,
      },
    });

    await tx.fotorankJudgeAuditEvent.create({
      data: {
        organizationId: contest.organizationId,
        contestId: contest.id,
        actorType: "JUDGE",
        actorJudgeId: params.judgeAccountId,
        eventType: "JUDGE_DIRECTORY_INVITE_ACCEPTED",
        entityType: "FotorankJudgeDirectoryInvitation",
        entityId: inv.id,
        payloadJson: { categoryIds },
      },
    });
  });

  return { ok: true };
}

export async function rejectDirectoryInvitationForJudge(params: {
  judgeAccountId: string;
  invitationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const inv = await prisma.fotorankJudgeDirectoryInvitation.findFirst({
    where: { id: params.invitationId, judgeAccountId: params.judgeAccountId, status: "PENDING" },
  });
  if (!inv) return { ok: false, error: "Invitación no encontrada o ya respondida." };
  const now = new Date();
  await prisma.fotorankJudgeDirectoryInvitation.update({
    where: { id: inv.id },
    data: { status: "REJECTED", rejectedAt: now, respondedAt: now },
  });
  return { ok: true };
}

export async function archiveDirectoryInvitationForJudge(params: {
  judgeAccountId: string;
  invitationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const inv = await prisma.fotorankJudgeDirectoryInvitation.findFirst({
    where: { id: params.invitationId, judgeAccountId: params.judgeAccountId },
  });
  if (!inv) return { ok: false, error: "No encontrada." };
  if (inv.status !== "PENDING" && inv.status !== "REJECTED" && inv.status !== "EXPIRED") {
    return { ok: false, error: "Solo podés archivar invitaciones pendientes, rechazadas o expiradas." };
  }
  const now = new Date();
  await prisma.fotorankJudgeDirectoryInvitation.update({
    where: { id: inv.id },
    data: { status: "ARCHIVED", archivedAt: now },
  });
  return { ok: true };
}

export async function cancelDirectoryInvitationForOrganizer(params: {
  organizationId: string;
  invitationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const inv = await prisma.fotorankJudgeDirectoryInvitation.findFirst({
    where: { id: params.invitationId, organizationId: params.organizationId, status: "PENDING" },
  });
  if (!inv) return { ok: false, error: "Invitación no encontrada o no se puede cancelar." };
  const now = new Date();
  await prisma.fotorankJudgeDirectoryInvitation.update({
    where: { id: inv.id },
    data: { status: "CANCELLED", cancelledAt: now, respondedAt: now },
  });
  return { ok: true };
}
