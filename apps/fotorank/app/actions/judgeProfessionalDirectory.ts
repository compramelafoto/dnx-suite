"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import { requireJudgeAuth } from "../lib/judge-auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import {
  listProfessionalDirectoryJudges,
  getOrganizerViewJudgeDetail,
  type DirectoryListFilters,
} from "../lib/fotorank/judges/professionalDirectory";
import {
  expireStaleDirectoryInvitationsNow,
  createDirectoryInvitationTx,
  acceptDirectoryInvitationForJudge,
  rejectDirectoryInvitationForJudge,
  archiveDirectoryInvitationForJudge,
  cancelDirectoryInvitationForOrganizer,
} from "../lib/fotorank/judges/directoryInvitationService";
import type { FotorankJudgeMethodType } from "@repo/db";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function requireOrg() {
  const user = await requireAuth();
  const r = await resolveActiveOrganizationForUser(user.id);
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, user, orgId: r.org.id };
}

export async function directoryListJudgesAction(
  filters: DirectoryListFilters,
  page?: number
): Promise<ActionResult<{ items: Awaited<ReturnType<typeof listProfessionalDirectoryJudges>>["items"]; totalApprox: number }>> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  await expireStaleDirectoryInvitationsNow();
  const p = Math.max(0, page ?? 0);
  const take = 24;
  const res = await listProfessionalDirectoryJudges(filters, { take, skip: p * take });
  return { ok: true, data: res };
}

export async function directoryGetJudgeDetailAction(
  judgeAccountId: string
): Promise<ActionResult<Awaited<ReturnType<typeof getOrganizerViewJudgeDetail>>>> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  const row = await getOrganizerViewJudgeDetail(judgeAccountId.trim());
  if (!row) return { ok: false, error: "Jurado no encontrado o no está en el directorio." };
  return { ok: true, data: row };
}

export async function directorySendInvitationAction(input: {
  judgeAccountId: string;
  contestId: string;
  categoryIds: string[];
  message: string;
  proposedRoleLabel?: string;
  compensationOfferedText?: string;
  organizerAcceptedExternalPaymentDisclaimer: boolean;
  methodType: FotorankJudgeMethodType;
  methodConfigJson?: unknown;
  assignmentType?: "PRIMARY" | "BACKUP";
}): Promise<ActionResult<{ id: string }>> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  const created = await createDirectoryInvitationTx({
    organizationId: scope.orgId,
    contestId: input.contestId.trim(),
    judgeAccountId: input.judgeAccountId.trim(),
    sentByUserId: scope.user.id,
    message: input.message,
    proposedRoleLabel: input.proposedRoleLabel ?? null,
    compensationOfferedText: input.compensationOfferedText ?? null,
    organizerAcceptedExternalPaymentDisclaimer: input.organizerAcceptedExternalPaymentDisclaimer,
    categoryIds: input.categoryIds,
    methodType: input.methodType,
    methodConfigJson: input.methodConfigJson ?? {},
    assignmentType: input.assignmentType ?? "PRIMARY",
  });
  if (!created.ok) return { ok: false, error: created.error };
  revalidatePath("/jurados/directorio");
  revalidatePath("/jurados/directorio/invitaciones");
  revalidatePath(`/jurados/directorio/${input.judgeAccountId.trim()}`);
  return { ok: true, data: { id: created.id } };
}

export async function directoryListSentInvitationsAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      status: string;
      createdAt: Date;
      message: string;
      judgeAccountId: string;
      judgeDisplayName: string;
      contestTitle: string;
    }>
  >
> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  await expireStaleDirectoryInvitationsNow();
  const rows = await prisma.fotorankJudgeDirectoryInvitation.findMany({
    where: { organizationId: scope.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      contest: { select: { title: true } },
      judgeAccount: { include: { profile: true } },
    },
  });
  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      message: r.message.slice(0, 200),
      judgeAccountId: r.judgeAccountId,
      judgeDisplayName: r.judgeAccount.profile
        ? `${r.judgeAccount.profile.firstName} ${r.judgeAccount.profile.lastName}`.trim()
        : r.judgeAccount.email,
      contestTitle: r.contest.title,
    })),
  };
}

export async function directoryCancelInvitationAction(invitationId: string): Promise<ActionResult> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  const r = await cancelDirectoryInvitationForOrganizer({ organizationId: scope.orgId, invitationId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/jurados/directorio/invitaciones");
  return { ok: true };
}

export async function judgeListContestsForInviteAction(): Promise<
  ActionResult<Array<{ id: string; title: string; categories: { id: string; name: string }[] }>>
> {
  const scope = await requireOrg();
  if (!scope.ok) return { ok: false, error: scope.error };
  const contests = await prisma.fotorankContest.findMany({
    where: {
      organizationId: scope.orgId,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      title: true,
      categories: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  return { ok: true, data: contests };
}

/** Invitaciones recibidas (sesión jurado). */
export async function judgeListDirectoryInvitationsReceivedAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      status: string;
      message: string;
      contestTitle: string;
      orgName: string;
      createdAt: Date;
      expiresAt: Date | null;
      proposedRoleLabel: string | null;
      compensationOfferedText: string | null;
    }>
  >
> {
  const judge = await requireJudgeAuth();
  await expireStaleDirectoryInvitationsNow();
  const rows = await prisma.fotorankJudgeDirectoryInvitation.findMany({
    where: { judgeAccountId: judge.id, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      contest: { select: { title: true } },
      organization: { select: { name: true } },
    },
  });
  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      contestTitle: r.contest.title,
      orgName: r.organization.name,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      proposedRoleLabel: r.proposedRoleLabel,
      compensationOfferedText: r.compensationOfferedText,
    })),
  };
}

export async function judgeAcceptDirectoryInvitationAction(invitationId: string): Promise<ActionResult> {
  const judge = await requireJudgeAuth();
  const r = await acceptDirectoryInvitationForJudge({ judgeAccountId: judge.id, invitationId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/jurado/invitaciones");
  revalidatePath("/jurado/panel");
  return { ok: true };
}

export async function judgeRejectDirectoryInvitationAction(invitationId: string): Promise<ActionResult> {
  const judge = await requireJudgeAuth();
  const r = await rejectDirectoryInvitationForJudge({ judgeAccountId: judge.id, invitationId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/jurado/invitaciones");
  return { ok: true };
}

export async function judgeArchiveDirectoryInvitationAction(invitationId: string): Promise<ActionResult> {
  const judge = await requireJudgeAuth();
  const r = await archiveDirectoryInvitationForJudge({ judgeAccountId: judge.id, invitationId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/jurado/invitaciones");
  return { ok: true };
}
