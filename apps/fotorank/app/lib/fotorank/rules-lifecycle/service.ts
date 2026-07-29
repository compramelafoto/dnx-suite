import { prisma, type Prisma } from "@repo/db";
import type { ContestRulesConfiguration } from "../rules-config/types";
import { hashContestRulesConfiguration } from "../rules-config/hash";
import { contentContainsPlaceholder, RULES_PLACEHOLDER_MARKER } from "../registration/rules-hash";
import { normalizeContestRulesDocument } from "./normalize-document";
import { compareRulesTextWithConfiguration, hasBlockingConflicts } from "./compare";
import { buildSectionsChecklist, missingRequiredSections } from "./sections-checklist";
import { parseExternalRulesAiResponse } from "./structured-import";
import { DeterministicSemanticValidator, resolveRulesTextGenerator } from "./generator";
import { buildSantaFeEnFoco2026RulesDraftMarkdown } from "./santa-fe-draft";

export class RulesLifecycleError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "RulesLifecycleError";
  }
}

const MUTABLE_STATUSES = new Set(["DRAFT", "GENERATED", "UNDER_REVIEW", "CHANGES_REQUESTED"]);

async function audit(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  action: string;
  notes?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.fotorankContestRulesAuditEvent.create({
    data: {
      contestId: input.contestId,
      rulesVersionId: input.rulesVersionId,
      actorUserId: input.actorUserId,
      action: input.action,
      notes: input.notes ?? null,
      metadataJson: input.metadata ?? undefined,
    },
  });
}

function parseConfig(json: unknown): ContestRulesConfiguration {
  return json as ContestRulesConfiguration;
}

async function loadPublishedConfig(contestId: string, configurationVersionId?: string | null) {
  if (configurationVersionId) {
    const row = await prisma.fotorankContestConfigurationVersion.findFirst({
      where: { id: configurationVersionId, contestId },
    });
    if (!row) throw new RulesLifecycleError("CONFIG_MISSING", "Configuración no encontrada.", 404);
    return row;
  }
  const row = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
  });
  if (!row) {
    throw new RulesLifecycleError("CONFIG_NOT_PUBLISHED", "No hay configuración publicada.", 409);
  }
  return row;
}

async function nextVersionNumber(contestId: string) {
  const last = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber ?? 0) + 1;
}

export async function generateRulesPromptForContest(contestId: string) {
  const cfg = await loadPublishedConfig(contestId);
  const config = parseConfig(cfg.configurationJson);
  const generator = resolveRulesTextGenerator();
  const result = await generator.generate(config);
  return { ...result, configurationVersionId: cfg.id };
}

export async function importRulesDocument(input: {
  contestId: string;
  configurationVersionId: string;
  title: string;
  content: string;
  createdByUserId: number;
  generatedBy?: "MANUAL" | "EXTERNAL_AI" | "OPENAI_API" | "TEMPLATE";
  status?: "DRAFT" | "GENERATED";
}) {
  const cfg = await loadPublishedConfig(input.contestId, input.configurationVersionId);
  if (cfg.status !== "PUBLISHED") {
    throw new RulesLifecycleError("CONFIG_NOT_PUBLISHED", "La configuración asociada debe estar publicada.");
  }
  const normalized = normalizeContestRulesDocument(input.content);
  if (!normalized.normalized.trim()) {
    throw new RulesLifecycleError("EMPTY", "Documento vacío.");
  }
  if (contentContainsPlaceholder(normalized.normalized) || /BORRADOR\s*—|REEMPLAZAR|\bTODO\b/i.test(normalized.normalized)) {
    throw new RulesLifecycleError("PLACEHOLDER", `Contiene placeholders (${RULES_PLACEHOLDER_MARKER}).`);
  }

  const config = parseConfig(cfg.configurationJson);
  const compare = compareRulesTextWithConfiguration(normalized.normalized, config);
  const sections = buildSectionsChecklist(normalized.normalized);
  const configHash = cfg.configurationHash || hashContestRulesConfiguration(config);

  const legalPending =
    config.rights.legalReviewFlags.length > 0 || config.rights.exclusive === true;

  const created = await prisma.fotorankContestRulesVersion.create({
    data: {
      contestId: input.contestId,
      versionNumber: await nextVersionNumber(input.contestId),
      title: input.title.trim() || "Bases y Condiciones",
      content: normalized.normalized,
      contentHash: normalized.contentHash,
      status: input.status ?? "GENERATED",
      configurationVersionId: cfg.id,
      configurationHashSnapshot: configHash,
      generatedBy: input.generatedBy ?? "EXTERNAL_AI",
      generatedAt: new Date(),
      originalImportedContent: normalized.original,
      contentFormat: normalized.format,
      compareSnapshotJson: compare as unknown as Prisma.InputJsonValue,
      sectionsChecklistJson: sections as unknown as Prisma.InputJsonValue,
      legalReviewStatus: legalPending ? "PENDING" : "NOT_REQUIRED",
      legalReviewNotes: legalPending
        ? "Licencia exclusiva/comercial/patrimonial: revisión jurídica pendiente antes de publicación productiva."
        : null,
      createdByUserId: input.createdByUserId,
    },
  });

  await audit({
    contestId: input.contestId,
    rulesVersionId: created.id,
    actorUserId: input.createdByUserId,
    action: "IMPORT_DOCUMENT",
    metadata: { contentHash: normalized.contentHash, configurationHash: configHash },
  });

  return {
    rulesVersionId: created.id,
    versionNumber: created.versionNumber,
    contentHash: created.contentHash,
    compare,
    sections,
    legalReviewStatus: created.legalReviewStatus,
  };
}

export async function importStructuredRulesResponse(input: {
  contestId: string;
  configurationVersionId: string;
  rawJson: string;
  createdByUserId: number;
}) {
  const cfg = await loadPublishedConfig(input.contestId, input.configurationVersionId);
  const parsed = parseExternalRulesAiResponse(input.rawJson);
  if (!parsed.ok) throw new RulesLifecycleError("INVALID_JSON", parsed.error);

  const configHash = cfg.configurationHash;
  const hashOk =
    !parsed.parsed.declaredConfigurationHash ||
    parsed.parsed.declaredConfigurationHash.toLowerCase() === configHash.toLowerCase();

  const imported = await importRulesDocument({
    contestId: input.contestId,
    configurationVersionId: cfg.id,
    title: parsed.parsed.documentTitle,
    content: parsed.parsed.rulesDocument,
    createdByUserId: input.createdByUserId,
    generatedBy: "EXTERNAL_AI",
    status: "GENERATED",
  });

  await prisma.fotorankContestRulesVersion.update({
    where: { id: imported.rulesVersionId },
    data: {
      structuredImportJson: parsed.parsed as unknown as Prisma.InputJsonValue,
      reviewNotes: [
        hashOk ? null : "WARNING: declaredConfigurationHash no coincide con la configuración asociada.",
        ...parsed.parsed.warnings.map((w) => `AI warning: ${w}`),
        ...parsed.parsed.missingDecisions.map((m) => `Missing: ${m}`),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  return { ...imported, hashDeclaredMatches: hashOk, structured: parsed.parsed };
}

export async function seedSantaFeRulesDraft(input: {
  contestId: string;
  configurationVersionId: string;
  createdByUserId: number;
}) {
  return importRulesDocument({
    contestId: input.contestId,
    configurationVersionId: input.configurationVersionId,
    title: "Bases y Condiciones — Santa Fe en Foco 2026 (borrador P0-09B)",
    content: buildSantaFeEnFoco2026RulesDraftMarkdown(),
    createdByUserId: input.createdByUserId,
    generatedBy: "TEMPLATE",
    status: "GENERATED",
  });
}

export async function submitRulesForReview(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  notes?: string;
}) {
  const row = await prisma.fotorankContestRulesVersion.findFirst({
    where: { id: input.rulesVersionId, contestId: input.contestId },
  });
  if (!row) throw new RulesLifecycleError("NOT_FOUND", "Versión no encontrada.", 404);
  if (!MUTABLE_STATUSES.has(row.status) && row.status !== "CHANGES_REQUESTED") {
    throw new RulesLifecycleError("IMMUTABLE", "Estado no permite envío a revisión.");
  }
  const updated = await prisma.fotorankContestRulesVersion.update({
    where: { id: row.id },
    data: { status: "UNDER_REVIEW", reviewNotes: input.notes ?? row.reviewNotes },
  });
  await audit({
    contestId: input.contestId,
    rulesVersionId: row.id,
    actorUserId: input.actorUserId,
    action: "SUBMIT_FOR_REVIEW",
    notes: input.notes,
  });
  return updated;
}

export async function requestRulesChanges(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  notes: string;
  requireDistinctApprover?: boolean;
}) {
  const row = await prisma.fotorankContestRulesVersion.findFirst({
    where: { id: input.rulesVersionId, contestId: input.contestId },
  });
  if (!row) throw new RulesLifecycleError("NOT_FOUND", "Versión no encontrada.", 404);
  if (row.status !== "UNDER_REVIEW" && row.status !== "APPROVED") {
    throw new RulesLifecycleError("INVALID_STATE", "Solo se solicitan cambios en revisión/aprobado.");
  }
  const updated = await prisma.fotorankContestRulesVersion.update({
    where: { id: row.id },
    data: {
      status: "CHANGES_REQUESTED",
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      reviewNotes: input.notes,
    },
  });
  await audit({
    contestId: input.contestId,
    rulesVersionId: row.id,
    actorUserId: input.actorUserId,
    action: "REQUEST_CHANGES",
    notes: input.notes,
  });
  return updated;
}

export async function approveRulesVersion(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  notes?: string;
  /** Si true, el aprobador no puede ser el mismo que generó/creó. */
  requireDistinctApprover?: boolean;
}) {
  const row = await prisma.fotorankContestRulesVersion.findFirst({
    where: { id: input.rulesVersionId, contestId: input.contestId },
  });
  if (!row) throw new RulesLifecycleError("NOT_FOUND", "Versión no encontrada.", 404);
  if (row.status !== "UNDER_REVIEW" && row.status !== "GENERATED") {
    throw new RulesLifecycleError("INVALID_STATE", "Debe estar en revisión (o GENERATED) para aprobar.");
  }
  if (input.requireDistinctApprover && row.createdByUserId === input.actorUserId) {
    throw new RulesLifecycleError(
      "DUAL_CONTROL",
      "Política de doble control: el aprobador debe ser distinto del autor/generador.",
      403,
    );
  }
  if (!row.configurationVersionId) {
    throw new RulesLifecycleError("CONFIG_MISSING", "Falta configuración asociada.");
  }

  const cfg = await loadPublishedConfig(input.contestId, row.configurationVersionId);
  const config = parseConfig(cfg.configurationJson);
  const compare = compareRulesTextWithConfiguration(row.content, config);
  if (hasBlockingConflicts(compare)) {
    throw new RulesLifecycleError("BLOCKING_CONFLICTS", "Hay contradicciones bloqueantes.");
  }
  if (contentContainsPlaceholder(row.content)) {
    throw new RulesLifecycleError("PLACEHOLDER", "Hay placeholders.");
  }

  const updated = await prisma.fotorankContestRulesVersion.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      approvedByUserId: input.actorUserId,
      approvedAt: new Date(),
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      reviewNotes: input.notes ?? row.reviewNotes,
      compareSnapshotJson: compare as unknown as Prisma.InputJsonValue,
      configurationHashSnapshot: cfg.configurationHash,
    },
  });
  await audit({
    contestId: input.contestId,
    rulesVersionId: row.id,
    actorUserId: input.actorUserId,
    action: "APPROVE",
    notes: input.notes,
  });
  return updated;
}

export async function markLegalReview(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  status: "REVIEWED" | "CHANGES_REQUESTED" | "PENDING";
  notes?: string;
}) {
  const row = await prisma.fotorankContestRulesVersion.findFirst({
    where: { id: input.rulesVersionId, contestId: input.contestId },
  });
  if (!row) throw new RulesLifecycleError("NOT_FOUND", "Versión no encontrada.", 404);
  const updated = await prisma.fotorankContestRulesVersion.update({
    where: { id: row.id },
    data: {
      legalReviewStatus: input.status,
      legalReviewNotes: input.notes ?? row.legalReviewNotes,
    },
  });
  await audit({
    contestId: input.contestId,
    rulesVersionId: row.id,
    actorUserId: input.actorUserId,
    action: "LEGAL_REVIEW",
    notes: input.notes,
    metadata: { status: input.status },
  });
  return updated;
}

/**
 * Publica bases aprobadas asociadas a configuración publicada.
 * Nunca publica automáticamente desde IA.
 */
export async function publishContestRulesVersion(input: {
  contestId: string;
  rulesVersionId: string;
  actorUserId: number;
  /** Solo local/staging: permite PENDING legal. Producción siempre bloquea. */
  allowLegalPendingForLocal?: boolean;
}) {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.FOTORANK_APP_ENV === "production";

  const row = await prisma.fotorankContestRulesVersion.findFirst({
    where: { id: input.rulesVersionId, contestId: input.contestId },
  });
  if (!row) throw new RulesLifecycleError("NOT_FOUND", "Versión no encontrada.", 404);
  if (row.status === "PUBLISHED") {
    throw new RulesLifecycleError("IMMUTABLE", "La versión ya está publicada.");
  }
  if (row.status !== "APPROVED") {
    throw new RulesLifecycleError("NOT_APPROVED", "Solo se publican versiones APPROVED.", 409);
  }
  if (!row.configurationVersionId || !row.configurationHashSnapshot) {
    throw new RulesLifecycleError("CONFIG_MISSING", "Falta asociación a configuración.");
  }

  const cfg = await loadPublishedConfig(input.contestId, row.configurationVersionId);
  if (cfg.status !== "PUBLISHED") {
    throw new RulesLifecycleError("CONFIG_NOT_PUBLISHED", "La configuración debe estar publicada.");
  }
  if (cfg.configurationHash !== row.configurationHashSnapshot) {
    throw new RulesLifecycleError("HASH_MISMATCH", "Hash de configuración no coincide.");
  }

  const config = parseConfig(cfg.configurationJson);
  const compare = compareRulesTextWithConfiguration(row.content, config);
  if (hasBlockingConflicts(compare)) {
    throw new RulesLifecycleError("BLOCKING_CONFLICTS", "Conflictos bloqueantes con la configuración.");
  }
  if (contentContainsPlaceholder(row.content) || !row.content.trim()) {
    throw new RulesLifecycleError("PLACEHOLDER", "Documento inválido o con placeholders.");
  }

  const sections = buildSectionsChecklist(row.content);
  const missing = missingRequiredSections(sections);
  if (missing.length > 6) {
    throw new RulesLifecycleError(
      "SECTIONS_MISSING",
      `Faltan secciones obligatorias: ${missing
        .slice(0, 8)
        .map((m) => m.label)
        .join(", ")}`,
    );
  }

  if (row.legalReviewStatus === "PENDING" || row.legalReviewStatus === "CHANGES_REQUESTED") {
    if (isProd || !input.allowLegalPendingForLocal) {
      throw new RulesLifecycleError(
        "LEGAL_PENDING",
        "Revisión jurídica de licencia pendiente: no se puede publicar.",
        403,
      );
    }
  }

  const semantic = await new DeterministicSemanticValidator().validate({
    config,
    document: row.content,
    deterministic: compare,
  });
  if (semantic.aiMayPublish) {
    throw new RulesLifecycleError("AI_PUBLISH_FORBIDDEN", "La IA no puede publicar bases.");
  }

  const published = await prisma.$transaction(async (tx) => {
    await tx.fotorankContestRulesVersion.updateMany({
      where: { contestId: input.contestId, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });

    const updated = await tx.fotorankContestRulesVersion.update({
      where: { id: row.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: input.actorUserId,
        compareSnapshotJson: compare as unknown as Prisma.InputJsonValue,
        sectionsChecklistJson: sections as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.fotorankContest.update({
      where: { id: input.contestId },
      data: { rulesText: row.content },
    });

    return updated;
  });

  await audit({
    contestId: input.contestId,
    rulesVersionId: row.id,
    actorUserId: input.actorUserId,
    action: "PUBLISH",
    metadata: { contentHash: row.contentHash, configurationHash: row.configurationHashSnapshot },
  });

  return {
    rulesVersionId: published.id,
    versionNumber: published.versionNumber,
    contentHash: published.contentHash,
    configurationVersionId: published.configurationVersionId,
    configurationHashSnapshot: published.configurationHashSnapshot,
  };
}

export async function revalidateRulesCompare(rulesVersionId: string) {
  const row = await prisma.fotorankContestRulesVersion.findUnique({
    where: { id: rulesVersionId },
    include: { configurationVersion: true },
  });
  if (!row?.configurationVersion) {
    throw new RulesLifecycleError("CONFIG_MISSING", "Sin configuración.");
  }
  const config = parseConfig(row.configurationVersion.configurationJson);
  const compare = compareRulesTextWithConfiguration(row.content, config);
  const sections = buildSectionsChecklist(row.content);
  await prisma.fotorankContestRulesVersion.update({
    where: { id: row.id },
    data: {
      compareSnapshotJson: compare as unknown as Prisma.InputJsonValue,
      sectionsChecklistJson: sections as unknown as Prisma.InputJsonValue,
    },
  });
  return { compare, sections };
}
