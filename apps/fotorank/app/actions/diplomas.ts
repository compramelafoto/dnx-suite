"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import {
  archiveDiplomaDesign,
  createDiplomaTemplate,
  ensureDefaultDiplomaTemplate,
  duplicateDiplomaTemplate,
} from "../lib/fotorank/diplomas/diplomaDesign";
import { readDiplomaFile } from "../lib/fotorank/diplomas/diplomaStorage";
import type { DiplomaIssuanceMode } from "../lib/fotorank/diplomas/issuanceTypes";
import { resolveDiplomaPlanRows } from "../lib/fotorank/diplomas/resolveRecipients";
import {
  issuePlanRows,
  revokeDiplomaIssued,
  reissueDiploma,
} from "../lib/fotorank/diplomas/issuanceCore";
import {
  buildBatchPaths,
  buildExcelTemplateBuffer,
  ensureDir,
  parseExcelRecipientsFromBuffer,
  sanitizeFileSlug,
  type ExcelValidationRow,
} from "../lib/fotorank/diplomas/excelBatch";
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

  const created = await ensureDefaultDiplomaTemplate({
    organizationId: org.organizationId,
    contestId,
    userId: user.id,
  });
  if (!created) return { ok: true as const, created: false };
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

const TEMPLATE_STATUSES = ["DRAFT", "READY", "ACTIVE", "ARCHIVED"] as const;

export async function createDiplomaTemplateAction(contestId: string, name?: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const n = name?.trim() || "Diploma nuevo";
  const created = await createDiplomaTemplate({
    organizationId: org.organizationId,
    contestId,
    userId: user.id,
    name: n,
    status: "DRAFT",
  });
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const, id: created.id };
}

export async function duplicateDiplomaTemplateAction(contestId: string, templateId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const src = await prisma.fotorankDiplomaTemplate.findFirst({
    where: { id: templateId, contestId, organizationId: org.organizationId },
  });
  if (!src) return { ok: false as const, error: "Plantilla no encontrada." };

  const baseName = src.name.trimEnd();
  const name = `${baseName.slice(0, 100)} (copia)`.slice(0, 120);

  const created = await duplicateDiplomaTemplate({
    organizationId: org.organizationId,
    contestId,
    userId: user.id,
    sourceLayoutJson: src.layoutJson,
    name,
  });
  if (!created) {
    return {
      ok: false as const,
      error: "Esta plantilla se hizo con el editor anterior y no se puede duplicar. Creá una nueva.",
    };
  }
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const, id: created.id };
}

export async function deleteDiplomaTemplateAction(contestId: string, templateId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const tpl = await prisma.fotorankDiplomaTemplate.findFirst({
    where: { id: templateId, contestId, organizationId: org.organizationId },
    select: { id: true, layoutJson: true },
  });
  if (!tpl) return { ok: false as const, error: "Plantilla no encontrada." };

  const issuedCount = await prisma.fotorankDiplomaIssued.count({
    where: { templateId, contestId, organizationId: org.organizationId },
  });
  if (issuedCount > 0) {
    return {
      ok: false as const,
      error:
        "No se puede eliminar: ya hay diplomas emitidos con esta plantilla. Archivala o duplicá el diseño en una plantilla nueva.",
    };
  }

  await prisma.fotorankDiplomaTemplate.delete({ where: { id: tpl.id } });
  await archiveDiplomaDesign(org.organizationId, tpl.layoutJson);
  revalidatePath(routes.dashboard.concursos.diplomas(contestId));
  return { ok: true as const };
}

export type UpdateDiplomaTemplateInput = {
  templateId: string;
  contestId: string;
  name?: string;
  status?: (typeof TEMPLATE_STATUSES)[number];
};

/** Nombre y estado. El diseño se cambia en el diseñador, no acá. */
export async function updateDiplomaTemplateAction(input: UpdateDiplomaTemplateInput) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(input.contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const existing = await prisma.fotorankDiplomaTemplate.findFirst({
    where: {
      id: input.templateId,
      contestId: input.contestId,
      organizationId: org.organizationId,
    },
    select: { id: true },
  });
  if (!existing) return { ok: false as const, error: "Plantilla no encontrada." };

  if (input.status != null && !TEMPLATE_STATUSES.includes(input.status as (typeof TEMPLATE_STATUSES)[number])) {
    return { ok: false as const, error: "Estado de plantilla no válido." };
  }

  await prisma.fotorankDiplomaTemplate.update({
    where: { id: existing.id },
    data: {
      version: { increment: 1 },
      ...(input.name != null && input.name.trim() ? { name: input.name.trim().slice(0, 120) } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });
  revalidatePath(routes.dashboard.concursos.diplomas(input.contestId));
  return { ok: true as const };
}

type ExcelBatchDraft = {
  draftId: string;
  contestId: string;
  sourceFileUrl: string;
  rows: ExcelValidationRow[];
  unknownColumns: string[];
  createdAt: string;
};

type ExcelBatchHistoryItem = {
  batchId: string;
  draftId: string;
  contestId: string;
  contestTitle: string;
  templateId: string;
  templateName: string;
  createdByUserId: number;
  createdAt: string;
  outputFormats: { pdf: boolean; png: boolean };
  withQr: boolean;
  withPublicVerification: boolean;
  totalRows: number;
  validRows: number;
  successCount: number;
  failedCount: number;
  zipUrl: string | null;
  reportUrl: string | null;
};

async function listBatchHistoryFile(contestId: string): Promise<ExcelBatchHistoryItem[]> {
  const historyDir = path.join(process.cwd(), "public", "uploads", "diplomas", "batches", sanitizeFileSlug(contestId).slice(0, 64));
  try {
    const entries = await fs.readdir(historyDir, { withFileTypes: true });
    const items: ExcelBatchHistoryItem[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(historyDir, entry.name, "meta.json");
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        items.push(JSON.parse(raw) as ExcelBatchHistoryItem);
      } catch {
        /* ignore invalid */
      }
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function downloadDiplomaExcelTemplateAction() {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const buffer = buildExcelTemplateBuffer();
  return { ok: true as const, filename: "plantilla-diplomas-fotorank.xlsx", base64: buffer.toString("base64") };
}

export async function parseDiplomaExcelDraftAction(formData: FormData) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };

  const contestId = String(formData.get("contestId") ?? "").trim();
  const file = formData.get("file");
  if (!contestId) return { ok: false as const, error: "ContestId requerido." };
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Subí un archivo .xlsx o .csv." };
  if (file.size > 10 * 1024 * 1024) return { ok: false as const, error: "Archivo demasiado grande (máx. 10 MB)." };

  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["xlsx", "csv"].includes(ext)) return { ok: false as const, error: "Formato no permitido. Usá .xlsx o .csv." };

  const draftId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const paths = buildBatchPaths(contestId, draftId);
  await ensureDir(paths.base);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(paths.sourceFile, buf);
  const { rows, unknownColumns } = parseExcelRecipientsFromBuffer(buf);
  const draft: ExcelBatchDraft = {
    draftId,
    contestId,
    sourceFileUrl: `/uploads/diplomas/batches/${sanitizeFileSlug(contestId).slice(0, 64)}/${draftId}/source.xlsx`,
    rows,
    unknownColumns,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(paths.draftFile, JSON.stringify(draft, null, 2), "utf8");
  return {
    ok: true as const,
    draftId,
    rows,
    unknownColumns,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.errors.length === 0).length,
    invalidRows: rows.filter((r) => r.errors.length > 0).length,
  };
}

export async function generateDiplomasFromExcelDraftAction(input: {
  contestId: string;
  draftId: string;
  templateId: string;
  output: "pdf" | "png" | "both";
  withQr: boolean;
  withPublicVerification: boolean;
  requireAllValid?: boolean;
}) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(input.contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };

  const tpl = await prisma.fotorankDiplomaTemplate.findFirst({
    where: { id: input.templateId, contestId: input.contestId, organizationId: org.organizationId },
    select: { id: true, name: true, status: true },
  });
  if (!tpl) return { ok: false as const, error: "Plantilla no encontrada." };

  const paths = buildBatchPaths(input.contestId, input.draftId);
  let draft: ExcelBatchDraft;
  try {
    draft = JSON.parse(await fs.readFile(paths.draftFile, "utf8")) as ExcelBatchDraft;
  } catch {
    return { ok: false as const, error: "No se encontró el borrador de importación. Volvé a subir el Excel." };
  }

  const rows = draft.rows;
  const invalidRows = rows.filter((r) => r.errors.length > 0);
  if ((input.requireAllValid ?? false) && invalidRows.length > 0) {
    return { ok: false as const, error: `Hay ${invalidRows.length} filas inválidas. Corregilas antes de generar.` };
  }

  const categories = await prisma.fotorankContestCategory.findMany({
    where: { contestId: input.contestId },
    select: { id: true, name: true },
  });
  const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const planRows = rows
    .filter((r) => r.errors.length === 0)
    .map((r) => ({
      key: `excel:${r.rowNumber}:${r.codigo_interno || r.nombre_completo}`,
      recipientType: "COLLABORATOR" as const,
      recipientName: r.nombre_completo,
      recipientUserId: null,
      entryId: null,
      judgeAccountId: null,
      contestCategoryId: categoryByName.get(r.categoria.trim().toLowerCase()) ?? null,
      prizeLabel: [r.premio, r.puesto ? `Puesto ${r.puesto}` : "", r.texto_adicional].filter(Boolean).join(" · ") || null,
      entryTitle: r.titulo_obra || null,
      errors: [],
      warnings: r.warnings,
    }));

  const outputFormats = input.output === "both" ? { pdf: true, png: true } : input.output === "pdf" ? { pdf: true, png: false } : { pdf: false, png: true };

  const { results, createdIds } = await issuePlanRows({
    issuedByUserId: user.id,
    organizationId: org.organizationId,
    contestId: input.contestId,
    templateId: input.templateId,
    rows: planRows,
    outputFormats,
    withVerification: input.withPublicVerification && input.withQr,
  });

  const okIds = results.filter((r): r is { ok: true; issuedId: string } => r.ok).map((r) => r.issuedId);
  const failed = results.filter((r) => !r.ok);

  const issuedRows = okIds.length
    ? await prisma.fotorankDiplomaIssued.findMany({
        where: { id: { in: okIds } },
        select: { id: true, recipientName: true, pdfUrl: true, pngUrl: true },
      })
    : [];

  const zip = new JSZip();
  for (const row of issuedRows) {
    const base = sanitizeFileSlug(`${contest.slug}-${row.recipientName}`).slice(0, 120);
    if (row.pdfUrl && outputFormats.pdf) {
      const pdf = await readDiplomaFile(input.contestId, row.id, "pdf");
      if (pdf) zip.file(`${base}.pdf`, pdf);
    }
    if (row.pngUrl && outputFormats.png) {
      const png = await readDiplomaFile(input.contestId, row.id, "png");
      if (png) zip.file(`${base}.png`, png);
    }
  }

  const reportLines = ["row,key,error"];
  for (const f of failed) reportLines.push(`,${f.key.replace(/,/g, " ")},${f.error.replace(/,/g, " ")}`);
  for (const r of invalidRows) reportLines.push(`${r.rowNumber},excel:${r.rowNumber},${r.errors.join(" | ").replace(/,/g, " ")}`);
  const reportCsv = reportLines.join("\n");
  await fs.writeFile(paths.reportFile, reportCsv, "utf8");

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(paths.zipFile, zipBuffer);

  const safeContest = sanitizeFileSlug(input.contestId).slice(0, 64);
  const zipUrl = `/uploads/diplomas/batches/${safeContest}/${input.draftId}/diplomas.zip`;
  const reportUrl = `/uploads/diplomas/batches/${safeContest}/${input.draftId}/errores.csv`;

  const meta: ExcelBatchHistoryItem = {
    batchId: input.draftId,
    draftId: input.draftId,
    contestId: input.contestId,
    contestTitle: contest.title,
    templateId: input.templateId,
    templateName: tpl.name,
    createdByUserId: user.id,
    createdAt: new Date().toISOString(),
    outputFormats,
    withQr: input.withQr,
    withPublicVerification: input.withPublicVerification,
    totalRows: rows.length,
    validRows: planRows.length,
    successCount: createdIds.length,
    failedCount: failed.length + invalidRows.length,
    zipUrl,
    reportUrl,
  };
  await fs.writeFile(path.join(paths.base, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  revalidatePath(routes.dashboard.concursos.diplomas(input.contestId));

  return {
    ok: true as const,
    batch: meta,
    failed,
    invalidRows: invalidRows.length,
  };
}

export async function listDiplomaExcelBatchesAction(contestId: string) {
  const user = await requireAuth();
  const org = await requireOrgForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await assertContestScope(contestId, org.organizationId);
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };
  const items = await listBatchHistoryFile(contestId);
  return { ok: true as const, items };
}
