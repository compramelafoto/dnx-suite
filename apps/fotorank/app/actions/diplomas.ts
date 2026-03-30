"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { defaultDiplomaLayoutJson } from "../lib/fotorank/diplomas/layoutSchema";
import type { DiplomaIssuanceMode } from "../lib/fotorank/diplomas/issuanceTypes";
import { resolveDiplomaPlanRows } from "../lib/fotorank/diplomas/resolveRecipients";
import {
  issuePlanRows,
  revokeDiplomaIssued,
  reissueDiploma,
} from "../lib/fotorank/diplomas/issuanceCore";
import { routes } from "../lib/routes";

async function requireOrgForUser(userId: number) {
  const r = await resolveActiveOrganizationForUser(userId);
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, organizationId: r.org.id };
}

async function assertContestScope(contestId: string, organizationId: string) {
  return prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId },
    select: { id: true, title: true, slug: true },
  });
}

export async function ensureDefaultDiplomaTemplateAction(contestId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const count = await prisma.fotorankDiplomaTemplate.count({ where: { contestId } });
  if (count > 0) return { ok: true as const, created: false };

  await prisma.fotorankDiplomaTemplate.create({
    data: {
      organizationId: org.organizationId,
      contestId,
      name: "Plantilla estándar",
      status: "ACTIVE",
      layoutJson: defaultDiplomaLayoutJson() as unknown as object,
      createdByUserId: user.id,
    },
  });
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const, created: true };
}

export type DiplomaPlanActionInput = {
  contestId: string;
  templateId: string;
  mode: DiplomaIssuanceMode;
  categoryId?: string | null;
  topN?: number;
  manualEntryIds?: string[];
  collaboratorNames?: string[];
  singleEntryId?: string | null;
  singleJudgeAccountId?: string | null;
  singleParticipantUserId?: number | null;
  singleCollaboratorName?: string | null;
  stampPrizeLabel?: string | null;
};

export async function planDiplomaIssuanceAction(input: DiplomaPlanActionInput) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(input.contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const template = await prisma.fotorankDiplomaTemplate.findFirst({
    where: {
      id: input.templateId,
      contestId: input.contestId,
      organizationId: org.organizationId,
    },
    select: { id: true, name: true, status: true, version: true, updatedAt: true },
  });
  if (!template) return { ok: false as const, error: "Plantilla no encontrada." };

  const plan = await resolveDiplomaPlanRows({
    contestId: input.contestId,
    mode: input.mode,
    categoryId: input.categoryId,
    topN: input.topN,
    manualEntryIds: input.manualEntryIds,
    collaboratorNames: input.collaboratorNames,
    singleEntryId: input.singleEntryId,
    singleJudgeAccountId: input.singleJudgeAccountId,
    singleParticipantUserId: input.singleParticipantUserId,
    singleCollaboratorName: input.singleCollaboratorName,
    stampPrizeLabel: input.stampPrizeLabel,
  });

  return {
    ok: true as const,
    template,
    plan,
  };
}

export async function executeDiplomaIssuanceAction(input: DiplomaPlanActionInput) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(input.contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const template = await prisma.fotorankDiplomaTemplate.findFirst({
    where: {
      id: input.templateId,
      contestId: input.contestId,
      organizationId: org.organizationId,
    },
    select: { id: true, status: true },
  });
  if (!template) return { ok: false as const, error: "Plantilla no encontrada." };
  if (template.status !== "ACTIVE" && template.status !== "READY") {
    return { ok: false as const, error: "La plantilla debe estar lista o activa para emitir." };
  }

  const plan = await resolveDiplomaPlanRows({
    contestId: input.contestId,
    mode: input.mode,
    categoryId: input.categoryId,
    topN: input.topN,
    manualEntryIds: input.manualEntryIds,
    collaboratorNames: input.collaboratorNames,
    singleEntryId: input.singleEntryId,
    singleJudgeAccountId: input.singleJudgeAccountId,
    singleParticipantUserId: input.singleParticipantUserId,
    singleCollaboratorName: input.singleCollaboratorName,
    stampPrizeLabel: input.stampPrizeLabel,
  });

  const rows = plan.rows.filter((r) => r.errors.length === 0);
  if (rows.length === 0) {
    return { ok: false as const, error: "No hay destinatarios válidos para emitir (revisá errores en el plan)." };
  }

  const { results, createdIds } = await issuePlanRows({
    issuedByUserId: user.id,
    organizationId: org.organizationId,
    contestId: input.contestId,
    templateId: input.templateId,
    rows,
  });

  const failed = results.filter((r) => !r.ok);
  revalidatePath(routes.dashboard.concursos.diplomas(input.contestId));

  return {
    ok: true as const,
    createdCount: createdIds.length,
    failed,
    planSnapshot: {
      errorRowCount: plan.errorRowCount,
      warningRowCount: plan.warningRowCount,
      globalWarnings: plan.globalWarnings,
    },
  };
}

export async function listIssuedDiplomasAction(
  contestId: string,
  opts?: { search?: string; status?: string }
) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const search = opts?.search?.trim();
  const statusRaw = opts?.status?.trim();
  const allowedStatus = ["ISSUED", "FAILED", "REVOKED", "REPLACED"] as const;
  const statusFilter =
    statusRaw && statusRaw !== "all" && (allowedStatus as readonly string[]).includes(statusRaw)
      ? (statusRaw as (typeof allowedStatus)[number])
      : undefined;

  const rows = await prisma.fotorankDiplomaIssued.findMany({
    where: {
      contestId,
      organizationId: org.organizationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { recipientName: { contains: search, mode: "insensitive" } },
              { diplomaCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      recipientType: true,
      recipientName: true,
      status: true,
      diplomaCode: true,
      verificationUrl: true,
      pdfUrl: true,
      pngUrl: true,
      renderedAt: true,
      createdAt: true,
      prizeLabel: true,
      failureReason: true,
      supersededById: true,
    },
  });

  return { ok: true as const, rows };
}

export async function revokeDiplomaAction(contestId: string, issuedId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const row = await prisma.fotorankDiplomaIssued.findFirst({
    where: { id: issuedId, contestId, organizationId: org.organizationId },
    select: { id: true },
  });
  if (!row) return { ok: false as const, error: "No encontrado." };

  const r = await revokeDiplomaIssued({ organizationId: org.organizationId, issuedId });
  if (!r.ok) return { ok: false as const, error: r.error };
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const };
}

export async function reissueDiplomaAction(contestId: string, issuedId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const row = await prisma.fotorankDiplomaIssued.findFirst({
    where: { id: issuedId, contestId, organizationId: org.organizationId },
    select: { id: true },
  });
  if (!row) return { ok: false as const, error: "No encontrado." };

  const r = await reissueDiploma({
    issuedByUserId: user.id,
    organizationId: org.organizationId,
    previousIssuedId: issuedId,
  });
  if (!r.ok) return { ok: false as const, error: r.error };
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const, newId: r.newId };
}

export async function getDiplomaPreviewSampleVariablesAction(contestId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.organizationId },
    select: { title: true, organization: { select: { name: true } } },
  });
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };
  return {
    ok: true as const,
    variables: {
      recipientName: "Nombre del destinatario",
      contestTitle: contest.title,
      organizerName: contest.organization.name,
      categoryName: "Nombre de categoría",
      prizeLabel: "Premio / reconocimiento",
      diplomaCode: "FR-EJEMPLO-00000000",
      issuedDate: new Date().toLocaleDateString("es-AR"),
      verificationUrl: "https://fotorank.app/diplomas/verificar/ejemplo",
    },
  };
}
