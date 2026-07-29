import { prisma, type Prisma } from "@repo/db";
import { RegistrationError } from "./errors";
import {
  RULES_PLACEHOLDER_MARKER,
  hashRulesContent,
  normalizeRulesContent,
} from "./rules-hash";
import { gatePlaceholderContent } from "./production-gate";

export type PublishedRulesVersion = {
  id: string;
  contestId: string;
  versionNumber: number;
  title: string;
  content: string;
  contentHash: string;
  publishedAt: Date | null;
  /** Snapshot de configuración estructurada asociada (P0-09A). */
  configurationVersionId: string | null;
};

export async function getCurrentPublishedRules(
  contestId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PublishedRulesVersion | null> {
  const row = await client.fotorankContestRulesVersion.findFirst({
    where: { contestId, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    contestId: row.contestId,
    versionNumber: row.versionNumber,
    title: row.title,
    content: row.content,
    contentHash: row.contentHash,
    publishedAt: row.publishedAt,
    configurationVersionId: row.configurationVersionId ?? null,
  };
}

export type PublishRulesInput = {
  contestId: string;
  title: string;
  content: string;
  createdByUserId: number;
  /** Solo true en seeds locales/staging. Bloquea placeholder en producción. */
  allowPlaceholder?: boolean;
};

/**
 * Publica una nueva versión de bases.
 * - Archiva la PUBLISHED anterior.
 * - No muta versiones publicadas previas.
 * - Sincroniza `rulesText` del concurso por compatibilidad (no es fuente de verdad).
 */
export async function publishRulesVersion(input: PublishRulesInput): Promise<PublishedRulesVersion> {
  const content = normalizeRulesContent(input.content);
  if (!content.trim()) {
    throw new RegistrationError("RULES_VERSION_MISSING", "El contenido de las bases no puede estar vacío.");
  }
  const gate = gatePlaceholderContent(content);
  if (!gate.allowed && !input.allowPlaceholder) {
    throw new RegistrationError(
      "PLACEHOLDER_RULES_BLOCKED",
      gate.warning ||
        `No se pueden publicar bases con marcadores tipo "${RULES_PLACEHOLDER_MARKER}" en producción.`,
      403,
    );
  }

  const contentHash = hashRulesContent(content);
  const title = input.title.trim() || `Bases v${Date.now()}`;

  const published = await prisma.$transaction(async (tx) => {
    const contest = await tx.fotorankContest.findUnique({
      where: { id: input.contestId },
      select: { id: true },
    });
    if (!contest) {
      throw new RegistrationError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
    }

    const last = await tx.fotorankContestRulesVersion.findFirst({
      where: { contestId: input.contestId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersion = (last?.versionNumber ?? 0) + 1;

    await tx.fotorankContestRulesVersion.updateMany({
      where: { contestId: input.contestId, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });

    const row = await tx.fotorankContestRulesVersion.create({
      data: {
        contestId: input.contestId,
        versionNumber: nextVersion,
        title,
        content,
        contentHash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdByUserId: input.createdByUserId,
      },
    });

    // Compat: espejo en rulesText (mutable). La verdad legal es RulesVersion.
    await tx.fotorankContest.update({
      where: { id: input.contestId },
      data: { rulesText: content },
    });

    return row;
  });

  return {
    id: published.id,
    contestId: published.contestId,
    versionNumber: published.versionNumber,
    title: published.title,
    content: published.content,
    contentHash: published.contentHash,
    publishedAt: published.publishedAt,
    configurationVersionId: published.configurationVersionId ?? null,
  };
}

/** Impide update destructivo de una versión PUBLISHED/ARCHIVED. */
export async function assertRulesVersionMutable(versionId: string): Promise<void> {
  const row = await prisma.fotorankContestRulesVersion.findUnique({
    where: { id: versionId },
    select: { status: true },
  });
  if (!row) {
    throw new RegistrationError("RULES_VERSION_MISSING", "Versión de bases no encontrada.", 404);
  }
  const mutable = new Set(["DRAFT", "GENERATED", "UNDER_REVIEW", "CHANGES_REQUESTED"]);
  if (!mutable.has(row.status)) {
    throw new RegistrationError(
      "RULES_VERSION_NOT_PUBLISHED",
      "Solo se pueden editar borradores o versiones en revisión. Para cambiar bases publicadas, creá una versión nueva.",
      409,
    );
  }
}

export type RulesVersionListItem = {
  id: string;
  versionNumber: number;
  title: string;
  status: string;
  contentHash: string;
  publishedAt: Date | null;
  createdAt: Date;
  createdByUserId: number;
  acceptanceCount: number;
  placeholderWarning: string | null;
  /** Solo borradores: permite editar en UI admin. */
  draftContent: string | null;
  configurationVersionId: string | null;
  configurationHashSnapshot: string | null;
  legalReviewStatus: string;
  reviewNotes: string | null;
  legalReviewNotes: string | null;
  compareSnapshotJson: unknown;
  sectionsChecklistJson: unknown;
};

export async function listRulesVersionsForContest(contestId: string): Promise<RulesVersionListItem[]> {
  const rows = await prisma.fotorankContestRulesVersion.findMany({
    where: { contestId },
    orderBy: { versionNumber: "desc" },
    include: {
      _count: { select: { registrations: true } },
    },
  });
  return rows.map((r) => {
    const gate = gatePlaceholderContent(r.content);
    return {
      id: r.id,
      versionNumber: r.versionNumber,
      title: r.title,
      status: r.status,
      contentHash: r.contentHash,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      createdByUserId: r.createdByUserId,
      acceptanceCount: r._count.registrations,
      placeholderWarning: gate.warning,
      draftContent: ["DRAFT", "GENERATED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(r.status)
        ? r.content
        : null,
      configurationVersionId: r.configurationVersionId,
      configurationHashSnapshot: r.configurationHashSnapshot,
      legalReviewStatus: r.legalReviewStatus,
      reviewNotes: r.reviewNotes,
      legalReviewNotes: r.legalReviewNotes,
      compareSnapshotJson: r.compareSnapshotJson,
      sectionsChecklistJson: r.sectionsChecklistJson,
    };
  });
}

export async function createRulesDraft(input: {
  contestId: string;
  title: string;
  content: string;
  createdByUserId: number;
}): Promise<{ id: string; versionNumber: number; warning: string | null }> {
  const content = normalizeRulesContent(input.content);
  if (!content.trim()) {
    throw new RegistrationError("RULES_VERSION_MISSING", "El contenido no puede estar vacío.");
  }
  const gate = gatePlaceholderContent(content);
  const last = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: input.contestId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const row = await prisma.fotorankContestRulesVersion.create({
    data: {
      contestId: input.contestId,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      title: input.title.trim() || "Borrador de bases",
      content,
      contentHash: hashRulesContent(content),
      status: "DRAFT",
      createdByUserId: input.createdByUserId,
    },
  });
  return { id: row.id, versionNumber: row.versionNumber, warning: gate.warning };
}

export async function updateRulesDraft(input: {
  versionId: string;
  title?: string;
  content?: string;
}): Promise<{ warning: string | null }> {
  await assertRulesVersionMutable(input.versionId);
  const content = input.content != null ? normalizeRulesContent(input.content) : undefined;
  if (content !== undefined && !content.trim()) {
    throw new RegistrationError("RULES_VERSION_MISSING", "El contenido no puede estar vacío.");
  }
  const gate = content != null ? gatePlaceholderContent(content) : { warning: null as string | null };
  await prisma.fotorankContestRulesVersion.update({
    where: { id: input.versionId },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(content != null
        ? { content, contentHash: hashRulesContent(content) }
        : {}),
    },
  });
  return { warning: gate.warning };
}

export async function publishExistingRulesDraft(input: {
  versionId: string;
  createdByUserId: number;
  allowPlaceholder?: boolean;
}): Promise<PublishedRulesVersion> {
  const draft = await prisma.fotorankContestRulesVersion.findUnique({
    where: { id: input.versionId },
  });
  if (!draft) throw new RegistrationError("RULES_VERSION_MISSING", "Versión no encontrada.", 404);
  if (draft.status !== "DRAFT") {
    throw new RegistrationError(
      "RULES_VERSION_NOT_PUBLISHED",
      "Solo se pueden publicar borradores.",
      409,
    );
  }
  // Publicar crea nueva versión inmutable vía publishRulesVersion (archiva published previa).
  // Para no duplicar número, actualizamos el draft a PUBLISHED en transacción.
  const gate = gatePlaceholderContent(draft.content);
  if (!gate.allowed && !input.allowPlaceholder) {
    throw new RegistrationError("PLACEHOLDER_RULES_BLOCKED", gate.warning!, 403);
  }

  const published = await prisma.$transaction(async (tx) => {
    await tx.fotorankContestRulesVersion.updateMany({
      where: { contestId: draft.contestId, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    const row = await tx.fotorankContestRulesVersion.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await tx.fotorankContest.update({
      where: { id: draft.contestId },
      data: { rulesText: draft.content },
    });
    return row;
  });

  return {
    id: published.id,
    contestId: published.contestId,
    versionNumber: published.versionNumber,
    title: published.title,
    content: published.content,
    contentHash: published.contentHash,
    publishedAt: published.publishedAt,
    configurationVersionId: published.configurationVersionId ?? null,
  };
}

export async function archiveRulesVersion(versionId: string): Promise<void> {
  const row = await prisma.fotorankContestRulesVersion.findUnique({ where: { id: versionId } });
  if (!row) throw new RegistrationError("RULES_VERSION_MISSING", "Versión no encontrada.", 404);
  if (row.status === "DRAFT") {
    await prisma.fotorankContestRulesVersion.update({
      where: { id: versionId },
      data: { status: "ARCHIVED" },
    });
    return;
  }
  if (row.status === "PUBLISHED") {
    throw new RegistrationError(
      "RULES_VERSION_NOT_PUBLISHED",
      "Para archivar la vigente, publicá una versión nueva (la anterior pasa a ARCHIVED automáticamente).",
      409,
    );
  }
}
