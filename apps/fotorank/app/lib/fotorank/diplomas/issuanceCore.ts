import { randomBytes } from "node:crypto";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@repo/db";
import { parseDiplomaLayoutJson } from "./layoutSchema";
import type { DiplomaMergeVariables } from "./mergeFields";
import { buildDiplomaVerificationUrl } from "./publicBaseUrl";
import { renderDiplomaPdf, pdfBufferToPngBuffer, sha256Hex } from "./renderDiploma";
import { saveDiplomaFile } from "./diplomaStorage";
import type { PlanRow } from "./issuanceTypes";

export function newVerificationToken(): string {
  return randomBytes(20).toString("base64url").replace(/=+$/, "");
}

export function newDiplomaCode(contestSlug: string): string {
  const part = contestSlug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "CONCURSO";
  return `FR-${part}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function buildMergeVariables(params: {
  row: PlanRow;
  contestTitle: string;
  organizerName: string;
  categoryName: string;
  diplomaCode: string;
  verificationUrl: string;
  issuedAt: Date;
}): DiplomaMergeVariables {
  const { row, contestTitle, organizerName, categoryName, diplomaCode, verificationUrl, issuedAt } =
    params;
  const issuedDate = format(issuedAt, "d MMM yyyy", { locale: es });
  return {
    recipientName: row.recipientName,
    contestTitle,
    organizerName,
    categoryName: categoryName || "—",
    prizeLabel: row.prizeLabel?.trim() || "—",
    diplomaCode,
    issuedDate,
    verificationUrl,
  };
}

async function uniqueDiplomaCode(slug: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newDiplomaCode(slug);
    const exists = await prisma.fotorankDiplomaIssued.findUnique({
      where: { diplomaCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `${newDiplomaCode(slug)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

async function uniqueVerificationToken(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const t = newVerificationToken();
    const exists = await prisma.fotorankDiplomaIssued.findUnique({
      where: { verificationToken: t },
      select: { id: true },
    });
    if (!exists) return t;
  }
  return newVerificationToken() + randomBytes(2).toString("hex");
}

export type IssueOneResult =
  | { ok: true; issuedId: string }
  | { ok: false; key: string; error: string };

/**
 * Crea registro, renderiza PDF/PNG y persiste URLs. Si falla el render, marca FAILED.
 */
export async function issueSinglePlanRow(params: {
  issuedByUserId: number;
  organizationId: string;
  contestId: string;
  templateId: string;
  row: PlanRow;
}): Promise<IssueOneResult> {
  const { issuedByUserId, organizationId, contestId, templateId, row } = params;
  if (row.errors.length > 0) {
    return { ok: false, key: row.key, error: row.errors.join(" ") };
  }

  const [template, contest, category] = await Promise.all([
    prisma.fotorankDiplomaTemplate.findFirst({
      where: { id: templateId, contestId, organizationId },
    }),
    prisma.fotorankContest.findUnique({
      where: { id: contestId },
      select: { id: true, title: true, slug: true, organization: { select: { name: true } } },
    }),
    row.contestCategoryId
      ? prisma.fotorankContestCategory.findFirst({
          where: { id: row.contestCategoryId, contestId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  if (!template || !contest) {
    return { ok: false, key: row.key, error: "Plantilla o concurso no encontrado." };
  }
  if (template.status !== "ACTIVE" && template.status !== "READY") {
    return {
      ok: false,
      key: row.key,
      error: "La plantilla debe estar en estado listo o activo para emitir.",
    };
  }

  const diplomaCode = await uniqueDiplomaCode(contest.slug);
  const verificationToken = await uniqueVerificationToken();
  const verificationUrl = buildDiplomaVerificationUrl(verificationToken);
  const qrValue = verificationUrl;
  const issuedAt = new Date();

  const categoryName = category?.name ?? "";
  const variables = buildMergeVariables({
    row,
    contestTitle: contest.title,
    organizerName: contest.organization.name,
    categoryName,
    diplomaCode,
    verificationUrl,
    issuedAt,
  });

  const layout = parseDiplomaLayoutJson(template.layoutJson);

  let created: Awaited<ReturnType<typeof prisma.fotorankDiplomaIssued.create>>;
  try {
    created = await prisma.fotorankDiplomaIssued.create({
      data: {
        organizationId,
        contestId,
        templateId,
        recipientType: row.recipientType,
        recipientName: row.recipientName,
        recipientUserId: row.recipientUserId,
        entryId: row.entryId,
        judgeAccountId: row.judgeAccountId,
        contestCategoryId: row.contestCategoryId,
        prizeLabel: row.prizeLabel,
        diplomaCode,
        verificationToken,
        verificationUrl,
        qrValue,
        status: "ISSUED",
        issuedByUserId,
        warningsJson: row.warnings.length ? row.warnings : undefined,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear el registro.";
    return { ok: false, key: row.key, error: msg };
  }

  try {
    const pdfBuffer = await renderDiplomaPdf({
      widthPt: template.widthPt,
      heightPt: template.heightPt,
      backgroundColor: template.backgroundColor,
      backgroundImageUrl: template.backgroundImageUrl,
      layout,
      variables,
      qrPayload: verificationUrl,
    });
    const pngBuffer = await pdfBufferToPngBuffer(pdfBuffer);
    const pdfSave = await saveDiplomaFile(contestId, created.id, "pdf", pdfBuffer);
    const pngSave = await saveDiplomaFile(contestId, created.id, "png", pngBuffer);
    const pdfChecksum = sha256Hex(pdfBuffer);
    const pngChecksum = sha256Hex(pngBuffer);

    await prisma.fotorankDiplomaIssued.update({
      where: { id: created.id },
      data: {
        pdfUrl: pdfSave.publicUrl,
        pngUrl: pngSave.publicUrl,
        pdfBytes: pdfSave.bytes,
        pngBytes: pngSave.bytes,
        pdfChecksum,
        pngChecksum,
        renderedAt: new Date(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al renderizar.";
    await prisma.fotorankDiplomaIssued.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failureReason: msg,
      },
    });
    return { ok: false, key: row.key, error: msg };
  }

  return { ok: true, issuedId: created.id };
}

export async function issuePlanRows(params: {
  issuedByUserId: number;
  organizationId: string;
  contestId: string;
  templateId: string;
  rows: PlanRow[];
}): Promise<{ results: IssueOneResult[]; createdIds: string[] }> {
  const results: IssueOneResult[] = [];
  const createdIds: string[] = [];
  for (const row of params.rows) {
    const r = await issueSinglePlanRow({
      issuedByUserId: params.issuedByUserId,
      organizationId: params.organizationId,
      contestId: params.contestId,
      templateId: params.templateId,
      row,
    });
    results.push(r);
    if (r.ok) createdIds.push(r.issuedId);
  }
  return { results, createdIds };
}

export async function revokeDiplomaIssued(params: {
  organizationId: string;
  issuedId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.fotorankDiplomaIssued.findFirst({
    where: { id: params.issuedId, organizationId: params.organizationId },
    select: { id: true, status: true },
  });
  if (!row) return { ok: false, error: "Diploma no encontrado." };
  if (row.status !== "ISSUED") return { ok: false, error: "Solo se pueden revocar diplomas emitidos correctamente." };
  await prisma.fotorankDiplomaIssued.update({
    where: { id: row.id },
    data: { status: "REVOKED" },
  });
  return { ok: true };
}

export async function reissueDiploma(params: {
  issuedByUserId: number;
  organizationId: string;
  previousIssuedId: string;
}): Promise<{ ok: true; newId: string } | { ok: false; error: string }> {
  const prev = await prisma.fotorankDiplomaIssued.findFirst({
    where: { id: params.previousIssuedId, organizationId: params.organizationId },
    include: { template: true },
  });
  if (!prev) return { ok: false, error: "Diploma anterior no encontrado." };
  if (prev.status !== "ISSUED") {
    return { ok: false, error: "Solo se puede reemitir un diploma vigente (estado emitido)." };
  }

  const planRow: PlanRow = {
    key: `reissue:${prev.id}`,
    recipientType: prev.recipientType,
    recipientName: prev.recipientName,
    recipientUserId: prev.recipientUserId,
    entryId: prev.entryId,
    judgeAccountId: prev.judgeAccountId,
    contestCategoryId: prev.contestCategoryId,
    prizeLabel: prev.prizeLabel,
    errors: [],
    warnings: [`Reemisión del diploma ${prev.diplomaCode}.`],
  };

  const created = await issueSinglePlanRow({
    issuedByUserId: params.issuedByUserId,
    organizationId: params.organizationId,
    contestId: prev.contestId,
    templateId: prev.templateId,
    row: planRow,
  });

  if (!created.ok) {
    return { ok: false, error: created.error };
  }

  await prisma.fotorankDiplomaIssued.update({
    where: { id: prev.id },
    data: {
      status: "REPLACED",
      supersededById: created.issuedId,
    },
  });

  return { ok: true, newId: created.issuedId };
}
