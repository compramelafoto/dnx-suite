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
    entryTitle: row.entryTitle?.trim() || "—",
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
  outputFormats?: { pdf: boolean; png: boolean };
  withVerification?: boolean;
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

  const withVerification = params.withVerification ?? true;
  const outputFormats = params.outputFormats ?? { pdf: true, png: true };
  const diplomaCode = withVerification ? await uniqueDiplomaCode(contest.slug) : `NO-VERIFY-${randomBytes(4).toString("hex").toUpperCase()}`;
  const verificationToken = withVerification ? await uniqueVerificationToken() : "";
  const verificationUrl = withVerification ? buildDiplomaVerificationUrl(verificationToken) : "";
  const qrValue = withVerification ? verificationUrl : "";
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
        verificationToken: verificationToken || `noverify-${randomBytes(10).toString("hex")}`,
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
      qrPayload: withVerification ? verificationUrl : "",
    });
    const pngBuffer = outputFormats.png ? await pdfBufferToPngBuffer(pdfBuffer) : null;
    const pdfSave = outputFormats.pdf ? await saveDiplomaFile(contestId, created.id, "pdf", pdfBuffer) : null;
    const pngSave = outputFormats.png && pngBuffer ? await saveDiplomaFile(contestId, created.id, "png", pngBuffer) : null;
    const pdfChecksum = outputFormats.pdf ? sha256Hex(pdfBuffer) : null;
    const pngChecksum = outputFormats.png && pngBuffer ? sha256Hex(pngBuffer) : null;

    await prisma.fotorankDiplomaIssued.update({
      where: { id: created.id },
      data: {
        ...(pdfSave ? { pdfUrl: pdfSave.publicUrl, pdfBytes: pdfSave.bytes, pdfChecksum: pdfChecksum ?? undefined } : {}),
        ...(pngSave ? { pngUrl: pngSave.publicUrl, pngBytes: pngSave.bytes, pngChecksum: pngChecksum ?? undefined } : {}),
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
  outputFormats?: { pdf: boolean; png: boolean };
  withVerification?: boolean;
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
      outputFormats: params.outputFormats,
      withVerification: params.withVerification,
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

  let entryTitle: string | null = null;
  if (prev.entryId) {
    const ent = await prisma.fotorankContestEntry.findUnique({
      where: { id: prev.entryId },
      select: { title: true },
    });
    entryTitle = ent?.title?.trim() || null;
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
    entryTitle,
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
