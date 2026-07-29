import { prisma, type Prisma } from "@repo/db";
import type { ContestRulesConfiguration } from "./types";
import { hashContestRulesConfiguration } from "./hash";
import { assertPublishable, validateContestRulesConfiguration } from "./validate";
import { toLegacyUploadPolicyJson } from "./policies";
import { contentContainsPlaceholder } from "../registration/rules-hash";
import { RULES_PLACEHOLDER_MARKER } from "../registration/rules-hash";

export class RulesConfigError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "RulesConfigError";
  }
}

function parseConfig(json: unknown): ContestRulesConfiguration {
  return json as ContestRulesConfiguration;
}

export async function getLatestDraftConfiguration(contestId: string) {
  return prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } },
    orderBy: { versionNumber: "desc" },
  });
}

export async function getPublishedConfiguration(contestId: string) {
  return prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
  });
}

export async function saveDraftConfiguration(input: {
  contestId: string;
  config: ContestRulesConfiguration;
  createdByUserId: number;
}): Promise<{ id: string; versionNumber: number; validation: ReturnType<typeof validateContestRulesConfiguration> }> {
  const validation = validateContestRulesConfiguration(input.config);
  const hash = hashContestRulesConfiguration(input.config);

  const draft = await getLatestDraftConfiguration(input.contestId);
  const data = {
    configurationJson: input.config as unknown as Prisma.InputJsonValue,
    configurationHash: hash,
    officialName: input.config.identity.officialName,
    timezone: input.config.identity.timezone,
    pricingMode: input.config.participation.pricingMode,
    priceAmountMinor: input.config.participation.priceAmountMinor,
    currency: input.config.participation.currency,
    platformFeeBps: input.config.participation.platformFeeBps,
    registrationOpensAt: new Date(input.config.schedule.registrationOpensAt),
    registrationClosesAtExclusive: new Date(input.config.schedule.registrationClosesAtExclusive),
    submissionOpensAt: new Date(input.config.schedule.submissionOpensAt),
    submissionClosesAtExclusive: new Date(input.config.schedule.submissionClosesAtExclusive),
    maxEntriesPerRegistration: input.config.participation.maxEntriesPerRegistration,
    maxCategoriesPerRegistration: input.config.participation.maxCategoriesPerRegistration,
    allowReplace: input.config.participation.allowReplaceUntilClose,
  };

  if (draft && draft.status !== "PUBLISHED") {
    const updated = await prisma.fotorankContestConfigurationVersion.update({
      where: { id: draft.id },
      data: { ...data, status: "DRAFT" },
    });
    return { id: updated.id, versionNumber: updated.versionNumber, validation };
  }

  const last = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId: input.contestId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const created = await prisma.fotorankContestConfigurationVersion.create({
    data: {
      contestId: input.contestId,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      status: "DRAFT",
      createdByUserId: input.createdByUserId,
      ...data,
    },
  });
  return { id: created.id, versionNumber: created.versionNumber, validation };
}

/**
 * Publica configuración: inmutable, aplica políticas al concurso + categorías.
 * No publica bases textuales automáticamente.
 */
export async function publishConfigurationVersion(input: {
  contestId: string;
  versionId: string;
  actorUserId: number;
  allowPendingHuman?: boolean;
}): Promise<{ configurationVersionId: string; hash: string }> {
  const row = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { id: input.versionId, contestId: input.contestId },
  });
  if (!row) throw new RulesConfigError("NOT_FOUND", "Versión de configuración no encontrada.", 404);
  if (row.status === "PUBLISHED") {
    throw new RulesConfigError("IMMUTABLE", "La versión ya está publicada e inmutable.");
  }

  const config = parseConfig(row.configurationJson);
  const validation = validateContestRulesConfiguration(config);
  if (validation.status === "INVALID") {
    throw new RulesConfigError("INVALID", "Configuración inválida; no se puede publicar.");
  }
  if (validation.status === "PENDING_HUMAN_CONFIRMATION" && !input.allowPendingHuman) {
    throw new RulesConfigError(
      "PENDING_HUMAN",
      "Hay decisiones humanas pendientes bloqueantes; no se puede publicar.",
    );
  }
  if (!input.allowPendingHuman) {
    assertPublishable(validation);
  }

  const hash = hashContestRulesConfiguration(config);

  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestConfigurationVersion.updateMany({
      where: { contestId: input.contestId, status: "PUBLISHED" },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    await tx.fotorankContestConfigurationVersion.update({
      where: { id: row.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        configurationHash: hash,
        configurationJson: config as unknown as Prisma.InputJsonValue,
      },
    });

    const reg = config.participation;
    const sch = config.schedule;
    await tx.fotorankContest.update({
      where: { id: input.contestId },
      data: {
        title: config.identity.officialName,
        timezone: config.identity.timezone,
        registrationPricingMode: reg.pricingMode,
        registrationPriceAmountMinor: reg.priceAmountMinor,
        registrationCurrency: reg.currency,
        platformFeeBps: reg.platformFeeBps,
        registrationOpensAt: new Date(sch.registrationOpensAt),
        registrationClosesAt: new Date(Date.parse(sch.registrationClosesAtExclusive) - 1),
        submissionOpensAt: new Date(sch.submissionOpensAt),
        submissionDeadline: new Date(Date.parse(sch.submissionClosesAtExclusive) - 1),
        uploadPolicyJson: toLegacyUploadPolicyJson(config) as unknown as Prisma.InputJsonValue,
        shortDescription: config.identity.description,
      },
    });

    for (const cat of config.categories) {
      await tx.fotorankContestCategory.upsert({
        where: { contestId_slug: { contestId: input.contestId, slug: cat.slug } },
        update: {
          name: cat.name,
          description: cat.description,
          maxFiles: cat.maxEntries,
          status: cat.active ? "ACTIVE" : "ARCHIVED",
          sortOrder: cat.sortOrder,
        },
        create: {
          contestId: input.contestId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          maxFiles: cat.maxEntries,
          status: cat.active ? "ACTIVE" : "ARCHIVED",
          sortOrder: cat.sortOrder,
        },
      });
    }
  });

  return { configurationVersionId: row.id, hash };
}

export async function importRulesTextDraft(input: {
  contestId: string;
  configurationVersionId: string;
  title: string;
  content: string;
  createdByUserId: number;
}): Promise<{ rulesVersionId: string }> {
  const content = input.content.trim();
  if (!content) throw new RulesConfigError("EMPTY", "El texto de bases está vacío.");
  if (contentContainsPlaceholder(content) || /BORRADOR|REEMPLAZAR|\bTODO\b|PENDIENTE/i.test(content)) {
    throw new RulesConfigError("PLACEHOLDER", `Texto contiene placeholders (${RULES_PLACEHOLDER_MARKER}).`);
  }

  const cfg = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { id: input.configurationVersionId, contestId: input.contestId },
  });
  if (!cfg) throw new RulesConfigError("CONFIG_MISSING", "Configuración asociada no encontrada.");

  const { createHash } = await import("node:crypto");
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  const contentHash = createHash("sha256").update(normalized, "utf8").digest("hex");

  const last = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: input.contestId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const created = await prisma.fotorankContestRulesVersion.create({
    data: {
      contestId: input.contestId,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      title: input.title,
      content,
      contentHash,
      status: "DRAFT",
      configurationVersionId: cfg.id,
      createdByUserId: input.createdByUserId,
    },
  });
  return { rulesVersionId: created.id };
}

export async function ensureSystemProvincialTemplate(createdByUserId?: number) {
  const { buildProvincialContestTemplateConfiguration } = await import("./provincial-template");
  const config = buildProvincialContestTemplateConfiguration();
  return prisma.fotorankContestRulesTemplate.upsert({
    where: { slug: "concurso-fotografico-provincial" },
    update: {
      name: "Concurso Fotográfico Provincial",
      description: "Plantilla genérica basada en el patrón Santa Fe en Foco (sin datos institucionales).",
      configurationJson: config as unknown as Prisma.InputJsonValue,
      isSystem: true,
      isActive: true,
    },
    create: {
      name: "Concurso Fotográfico Provincial",
      slug: "concurso-fotografico-provincial",
      description: "Plantilla genérica basada en el patrón Santa Fe en Foco (sin datos institucionales).",
      category: "provincial",
      configurationJson: config as unknown as Prisma.InputJsonValue,
      isSystem: true,
      isActive: true,
      createdByUserId: createdByUserId ?? null,
    },
  });
}
