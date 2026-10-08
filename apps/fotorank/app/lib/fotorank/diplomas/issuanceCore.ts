import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { buildDiplomaVerificationUrl } from "./publicBaseUrl";
import { saveDiplomaFile } from "./diplomaStorage";
import type { PlanRow } from "./issuanceTypes";
import { DIPLOMA_CANVAS_PX, readDiplomaDesignLink } from "../design/constants";
import { loadDesignDocument } from "../design/templates";
import { renderDesign, slugArchivo, type DesignValues } from "../design/render";
import { entryImageRef } from "../design/images";

/** Resolución del PNG de un diploma: A4 a 150 dpi (1754 × 1240), para compartir en pantalla. */
const DIPLOMA_PNG_DPI = 150;

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** La fecha de hoy en Argentina, como AAAA-MM-DD: el diploma lleva la fecha local, no la UTC. */
export function fechaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

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

/**
 * Los datos del diploma, con las claves del catálogo del diseñador (`plugins/fotorank`).
 * Lo que no aplica va vacío y su bloque no se dibuja: un diploma de jurado no tiene obra.
 */
export function buildDiplomaValues(params: {
  row: PlanRow;
  contestTitle: string;
  organizerName: string;
  organizerLogo: string | null;
  categoryName: string;
  diplomaCode: string;
  verificationUrl: string;
  issuedAt: Date;
}): DesignValues {
  const { row } = params;
  return {
    recipientName: row.recipientName,
    entryTitle: row.entryTitle?.trim() || null,
    entryImage: row.entryId ? entryImageRef(row.entryId) : null,
    prizeLabel: row.prizeLabel?.trim() || null,
    categoryName: params.categoryName.trim() || null,
    contestTitle: params.contestTitle,
    organizerName: params.organizerName,
    organizerLogo: params.organizerLogo,
    issuedDate: fechaArgentina(params.issuedAt),
    diplomaCode: params.diplomaCode || null,
    verificationUrl: params.verificationUrl || null,
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
      select: {
        id: true,
        title: true,
        slug: true,
        organization: { select: { name: true, logoUrl: true } },
      },
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

  const link = readDiplomaDesignLink(template.layoutJson);
  if (!link) {
    return {
      ok: false,
      key: row.key,
      error: "Esta plantilla se hizo con el editor anterior. Creá una plantilla nueva para emitir.",
    };
  }

  const categoryName = category?.name ?? "";
  const values = buildDiplomaValues({
    row,
    contestTitle: contest.title,
    organizerName: contest.organization.name,
    organizerLogo: contest.organization.logoUrl ?? null,
    categoryName,
    diplomaCode: withVerification ? diplomaCode : "",
    verificationUrl,
    issuedAt,
  });

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
    const design = await loadDesignDocument({
      organizationId,
      templateId: link.designTemplateId,
      documentName: "Diploma",
      fallbackCanvas: DIPLOMA_CANVAS_PX,
    });
    if (!design) throw new Error("No se encontró el diseño de la plantilla.");
    const rendered = await renderDesign({
      design,
      values,
      formats: [
        ...(outputFormats.pdf ? (["PDF"] as const) : []),
        ...(outputFormats.png ? (["PNG"] as const) : []),
      ],
      fileBaseName: slugArchivo(`diploma-${row.recipientName}`, "diploma"),
      pngDpi: DIPLOMA_PNG_DPI,
    });
    if (!rendered.ok) throw new Error(rendered.errors.join(" "));
    const pdfSave = rendered.pdf ? await saveDiplomaFile(contestId, created.id, "pdf", rendered.pdf) : null;
    const pngSave = rendered.png ? await saveDiplomaFile(contestId, created.id, "png", rendered.png) : null;

    await prisma.fotorankDiplomaIssued.update({
      where: { id: created.id },
      data: {
        ...(pdfSave && rendered.pdf
          ? { pdfUrl: pdfSave.publicUrl, pdfBytes: pdfSave.bytes, pdfChecksum: sha256Hex(rendered.pdf) }
          : {}),
        ...(pngSave && rendered.png
          ? { pngUrl: pngSave.publicUrl, pngBytes: pngSave.bytes, pngChecksum: sha256Hex(rendered.png) }
          : {}),
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
