import { prisma as defaultPrisma, type PrismaClient, Prisma } from "@repo/db";
import { normalizeTitle } from "./normalize";
import {
  assertAssignable,
  assertTransition,
} from "./workflow";
import {
  buildAssignmentSnapshot,
  snapshotToClickatonFields,
} from "./assignment";
import { importPreview, type ImportPreviewResult } from "./import";
import type {
  AssignToEditionInput,
  CreateLibraryItemInput,
  ImportRow,
  LibraryKpis,
  ListItemsFilters,
  PhotoPromptStatus,
  UpdateLibraryItemInput,
} from "./types";
import { MAX_PROMPTS_PER_EDITION } from "./types";

export type PhotoPromptLibraryDeps = {
  prisma?: PrismaClient;
};

function db(deps?: PhotoPromptLibraryDeps): PrismaClient {
  return deps?.prisma ?? defaultPrisma;
}

const SIGNIFICANT_KEYS = [
  "title",
  "description",
  "themeId",
  "subthemeId",
  "inspirationType",
  "inspirationLabel",
  "inspirationNotes",
  "tags",
  "difficulty",
  "language",
  "universal",
] as const;

function tagsEqual(a: string[] | undefined, b: string[]): boolean {
  if (!a) return true;
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function isSignificantUpdate(
  current: {
    title: string;
    description: string;
    themeId: string;
    subthemeId: string | null;
    inspirationType: string | null;
    inspirationLabel: string | null;
    inspirationNotes: string | null;
    tags: string[];
    difficulty: string;
    language: string;
    universal: boolean;
  },
  input: UpdateLibraryItemInput,
): boolean {
  for (const key of SIGNIFICANT_KEYS) {
    if (key === "tags") {
      if (input.tags !== undefined && !tagsEqual(input.tags, current.tags)) {
        return true;
      }
      continue;
    }
    if (input[key] !== undefined && input[key] !== current[key]) {
      return true;
    }
  }
  return false;
}

export async function listThemes(deps?: PhotoPromptLibraryDeps) {
  return db(deps).photoPromptTheme.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      subthemes: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      _count: { select: { items: true } },
    },
  });
}

function asStatusArray(
  status?: PhotoPromptStatus | PhotoPromptStatus[],
): PhotoPromptStatus[] | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status : [status];
}

export async function listItems(
  filters: ListItemsFilters = {},
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const status = asStatusArray(filters.status);
  const difficulty = filters.difficulty
    ? Array.isArray(filters.difficulty)
      ? filters.difficulty
      : [filters.difficulty]
    : undefined;
  const inspirationType = filters.inspirationType
    ? Array.isArray(filters.inspirationType)
      ? filters.inspirationType
      : [filters.inspirationType]
    : undefined;

  const recentlyCutoff =
    filters.recentlyUsedDays != null
      ? new Date(Date.now() - filters.recentlyUsedDays * 24 * 60 * 60 * 1000)
      : null;

  const where: Prisma.PhotoPromptLibraryItemWhereInput = {
    ...(filters.themeId ? { themeId: filters.themeId } : {}),
    ...(filters.subthemeId ? { subthemeId: filters.subthemeId } : {}),
    ...(status ? { status: { in: status } } : {}),
    ...(difficulty ? { difficulty: { in: difficulty } } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.universal != null ? { universal: filters.universal } : {}),
    ...(inspirationType ? { inspirationType: { in: inspirationType } } : {}),
    ...(filters.text
      ? {
          OR: [
            { title: { contains: filters.text, mode: "insensitive" } },
            { description: { contains: filters.text, mode: "insensitive" } },
            { tags: { has: filters.text } },
          ],
        }
      : {}),
    ...(filters.neverUsed ? { assignments: { none: {} } } : {}),
    ...(recentlyCutoff
      ? {
          assignments: {
            some: { assignedFromLibraryAt: { gte: recentlyCutoff } },
          },
        }
      : {}),
  };

  const items = await prisma.photoPromptLibraryItem.findMany({
    where,
    include: {
      theme: true,
      subtheme: true,
      _count: { select: { assignments: true } },
      assignments: {
        orderBy: { assignedFromLibraryAt: "desc" },
        take: 1,
        select: { assignedFromLibraryAt: true, editionId: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: filters.take ?? 100,
    skip: filters.skip ?? 0,
  });

  let filtered = items;
  if (filters.usageMin != null) {
    filtered = filtered.filter(
      (i) => i._count.assignments >= filters.usageMin!,
    );
  }
  if (filters.usageMax != null) {
    filtered = filtered.filter(
      (i) => i._count.assignments <= filters.usageMax!,
    );
  }

  return filtered.map((item) => ({
    ...item,
    usageCount: item._count.assignments,
    lastUsedAt: item.assignments[0]?.assignedFromLibraryAt ?? null,
  }));
}

export async function getItem(id: string, deps?: PhotoPromptLibraryDeps) {
  const item = await db(deps).photoPromptLibraryItem.findUnique({
    where: { id },
    include: {
      theme: true,
      subtheme: true,
      versions: { orderBy: { version: "desc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 50 },
      assignments: {
        orderBy: { assignedFromLibraryAt: "desc" },
        select: {
          id: true,
          editionId: true,
          sequence: true,
          libraryVersion: true,
          assignedFromLibraryAt: true,
          titleSnapshot: true,
          status: true,
        },
      },
      _count: { select: { assignments: true, versions: true, audits: true } },
    },
  });
  if (!item) return null;
  return {
    ...item,
    usageCount: item._count.assignments,
  };
}

export async function getKpis(deps?: PhotoPromptLibraryDeps): Promise<LibraryKpis> {
  const prisma = db(deps);
  const [total, draft, inReview, approved, rejected, archived, used] =
    await Promise.all([
      prisma.photoPromptLibraryItem.count(),
      prisma.photoPromptLibraryItem.count({ where: { status: "DRAFT" } }),
      prisma.photoPromptLibraryItem.count({ where: { status: "IN_REVIEW" } }),
      prisma.photoPromptLibraryItem.count({ where: { status: "APPROVED" } }),
      prisma.photoPromptLibraryItem.count({ where: { status: "REJECTED" } }),
      prisma.photoPromptLibraryItem.count({ where: { status: "ARCHIVED" } }),
      prisma.photoPromptLibraryItem.count({
        where: { assignments: { some: {} } },
      }),
    ]);
  return {
    total,
    draft,
    inReview,
    approved,
    rejected,
    archived,
    used,
    neverUsed: total - used,
  };
}

async function writeAudit(
  prisma: PrismaClient,
  data: {
    libraryItemId?: string | null;
    editionId?: string | null;
    actorUserId?: number | null;
    action: Prisma.PhotoPromptLibraryAuditEventCreateInput["action"];
    comment?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  },
) {
  return prisma.photoPromptLibraryAuditEvent.create({
    data: {
      libraryItemId: data.libraryItemId ?? null,
      editionId: data.editionId ?? null,
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      comment: data.comment ?? null,
      metadataJson: data.metadataJson ?? undefined,
    },
  });
}

export async function createItem(
  input: CreateLibraryItemInput,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const title = input.title.trim();
  if (!title) throw new Error("title es obligatorio");
  if (!input.description.trim()) throw new Error("description es obligatorio");

  const created = await prisma.photoPromptLibraryItem.create({
    data: {
      title,
      normalizedTitle: normalizeTitle(title),
      description: input.description.trim(),
      themeId: input.themeId,
      subthemeId: input.subthemeId ?? null,
      inspirationType: input.inspirationType ?? null,
      inspirationLabel: input.inspirationLabel ?? null,
      inspirationNotes: input.inspirationNotes ?? null,
      tags: input.tags ?? [],
      difficulty: input.difficulty ?? "MEDIUM",
      language: input.language ?? "es",
      universal: input.universal ?? true,
      status: "DRAFT",
      version: 1,
      sourceKey: input.sourceKey ?? null,
      metadataJson:
        input.metadataJson === undefined
          ? undefined
          : (input.metadataJson as Prisma.InputJsonValue),
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await prisma.photoPromptLibraryVersion.create({
    data: {
      libraryItemId: created.id,
      version: 1,
      title: created.title,
      description: created.description,
      themeId: created.themeId,
      subthemeId: created.subthemeId,
      inspirationType: created.inspirationType,
      inspirationLabel: created.inspirationLabel,
      inspirationNotes: created.inspirationNotes,
      tags: created.tags,
      difficulty: created.difficulty,
      language: created.language,
      universal: created.universal,
      status: "DRAFT",
      changeSummary: "Creación",
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await writeAudit(prisma, {
    libraryItemId: created.id,
    actorUserId: input.createdByUserId,
    action: "CREATE",
  });

  return created;
}

export async function updateItem(
  id: string,
  input: UpdateLibraryItemInput,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const current = await prisma.photoPromptLibraryItem.findUnique({
    where: { id },
  });
  if (!current) throw new Error(`Item no encontrado: ${id}`);

  const significant = isSignificantUpdate(current, input);
  const nextVersion = significant ? current.version + 1 : current.version;
  const nextTitle = input.title?.trim() ?? current.title;

  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: {
      ...(input.title !== undefined
        ? { title: nextTitle, normalizedTitle: normalizeTitle(nextTitle) }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() }
        : {}),
      ...(input.themeId !== undefined ? { themeId: input.themeId } : {}),
      ...(input.subthemeId !== undefined
        ? { subthemeId: input.subthemeId }
        : {}),
      ...(input.inspirationType !== undefined
        ? { inspirationType: input.inspirationType }
        : {}),
      ...(input.inspirationLabel !== undefined
        ? { inspirationLabel: input.inspirationLabel }
        : {}),
      ...(input.inspirationNotes !== undefined
        ? { inspirationNotes: input.inspirationNotes }
        : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.difficulty !== undefined
        ? { difficulty: input.difficulty }
        : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.universal !== undefined ? { universal: input.universal } : {}),
      ...(input.metadataJson !== undefined
        ? { metadataJson: input.metadataJson as Prisma.InputJsonValue }
        : {}),
      ...(significant ? { version: nextVersion } : {}),
    },
  });

  if (significant) {
    await prisma.photoPromptLibraryVersion.create({
      data: {
        libraryItemId: id,
        version: nextVersion,
        title: updated.title,
        description: updated.description,
        themeId: updated.themeId,
        subthemeId: updated.subthemeId,
        inspirationType: updated.inspirationType,
        inspirationLabel: updated.inspirationLabel,
        inspirationNotes: updated.inspirationNotes,
        tags: updated.tags,
        difficulty: updated.difficulty,
        language: updated.language,
        universal: updated.universal,
        status: updated.status,
        changeSummary: input.changeSummary ?? "Actualización significativa",
        createdByUserId: input.actorUserId ?? null,
        snapshotJson: {
          fromVersion: current.version,
          toVersion: nextVersion,
        },
      },
    });
    await writeAudit(prisma, {
      libraryItemId: id,
      actorUserId: input.actorUserId,
      action: "UPDATE",
      comment: input.changeSummary ?? null,
      metadataJson: { version: nextVersion },
    });
  }

  return updated;
}

export async function duplicateItem(
  id: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const source = await prisma.photoPromptLibraryItem.findUnique({
    where: { id },
  });
  if (!source) throw new Error(`Item no encontrado: ${id}`);

  const copy = await createItem(
    {
      title: `${source.title} (copia)`,
      description: source.description,
      themeId: source.themeId,
      subthemeId: source.subthemeId,
      inspirationType: source.inspirationType,
      inspirationLabel: source.inspirationLabel,
      inspirationNotes: source.inspirationNotes,
      tags: source.tags,
      difficulty: source.difficulty,
      language: source.language,
      universal: source.universal,
      createdByUserId: actorUserId ?? null,
      metadataJson: { duplicatedFrom: source.id },
    },
    deps,
  );

  await writeAudit(prisma, {
    libraryItemId: copy.id,
    actorUserId,
    action: "DUPLICATE",
    metadataJson: { fromId: source.id },
  });

  return copy;
}

export async function submitForReview(
  id: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({ where: { id } });
  if (!item) throw new Error(`Item no encontrado: ${id}`);
  assertTransition(item.status, "IN_REVIEW");
  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: {
      status: "IN_REVIEW",
      submittedForReviewAt: new Date(),
      reviewedByUserId: null,
      rejectionReason: null,
    },
  });
  await writeAudit(prisma, {
    libraryItemId: id,
    actorUserId,
    action: "SUBMIT_REVIEW",
  });
  return updated;
}

export async function approve(
  id: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({ where: { id } });
  if (!item) throw new Error(`Item no encontrado: ${id}`);
  assertTransition(item.status, "APPROVED");
  const now = new Date();
  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: now,
      reviewedAt: now,
      approvedByUserId: actorUserId ?? null,
      reviewedByUserId: actorUserId ?? null,
      rejectionReason: null,
      rejectedAt: null,
    },
  });
  await writeAudit(prisma, {
    libraryItemId: id,
    actorUserId,
    action: "APPROVE",
  });
  return updated;
}

export async function reject(
  id: string,
  reason: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({ where: { id } });
  if (!item) throw new Error(`Item no encontrado: ${id}`);
  assertTransition(item.status, "REJECTED");
  if (!reason.trim()) throw new Error("reason es obligatorio para rechazar");
  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      reviewedAt: new Date(),
      rejectionReason: reason.trim(),
      reviewedByUserId: actorUserId ?? null,
    },
  });
  await writeAudit(prisma, {
    libraryItemId: id,
    actorUserId,
    action: "REJECT",
    comment: reason.trim(),
  });
  return updated;
}

export async function archive(
  id: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({ where: { id } });
  if (!item) throw new Error(`Item no encontrado: ${id}`);
  assertTransition(item.status, "ARCHIVED");
  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await writeAudit(prisma, {
    libraryItemId: id,
    actorUserId,
    action: "ARCHIVE",
  });
  return updated;
}

export async function restore(
  id: string,
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({ where: { id } });
  if (!item) throw new Error(`Item no encontrado: ${id}`);

  let next: PhotoPromptStatus;
  if (item.status === "REJECTED") next = "DRAFT";
  else if (item.status === "ARCHIVED") next = "APPROVED";
  else {
    throw new Error(
      `restore solo desde REJECTED o ARCHIVED (actual: ${item.status})`,
    );
  }
  assertTransition(item.status, next);

  const updated = await prisma.photoPromptLibraryItem.update({
    where: { id },
    data: {
      status: next,
      ...(next === "DRAFT"
        ? {
            rejectionReason: null,
            rejectedAt: null,
          }
        : {
            archivedAt: null,
            approvedAt: new Date(),
          }),
    },
  });
  await writeAudit(prisma, {
    libraryItemId: id,
    actorUserId,
    action: "RESTORE",
    metadataJson: { from: item.status, to: next },
  });
  return updated;
}

export async function getHistory(id: string, deps?: PhotoPromptLibraryDeps) {
  const prisma = db(deps);
  const [versions, audits] = await Promise.all([
    prisma.photoPromptLibraryVersion.findMany({
      where: { libraryItemId: id },
      orderBy: { version: "desc" },
    }),
    prisma.photoPromptLibraryAuditEvent.findMany({
      where: { libraryItemId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { versions, audits };
}

export async function getUsage(itemId: string, deps?: PhotoPromptLibraryDeps) {
  const assignments = await db(deps).clickatonPrompt.findMany({
    where: { libraryItemId: itemId },
    orderBy: { assignedFromLibraryAt: "desc" },
    select: {
      id: true,
      editionId: true,
      sequence: true,
      libraryVersion: true,
      titleSnapshot: true,
      assignedFromLibraryAt: true,
      status: true,
    },
  });
  return {
    itemId,
    usageCount: assignments.length,
    assignments,
  };
}

export async function assignToEdition(
  input: AssignToEditionInput,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const item = await prisma.photoPromptLibraryItem.findUnique({
    where: { id: input.libraryItemId },
    include: { theme: true, subtheme: true },
  });
  if (!item) throw new Error(`Item no encontrado: ${input.libraryItemId}`);

  assertAssignable({
    status: item.status,
    allowDraftForOpsTest: input.allowDraftForOpsTest === true,
  });

  const existingCount = await prisma.clickatonPrompt.count({
    where: { editionId: input.editionId },
  });
  if (existingCount >= MAX_PROMPTS_PER_EDITION) {
    throw new Error(
      `Máximo ${MAX_PROMPTS_PER_EDITION} consignas por edición (actual: ${existingCount}).`,
    );
  }

  const maxSeq = await prisma.clickatonPrompt.aggregate({
    where: { editionId: input.editionId },
    _max: { sequence: true },
  });
  const sequence =
    input.sequence ?? (maxSeq._max.sequence != null ? maxSeq._max.sequence + 1 : 1);

  const snapshot = buildAssignmentSnapshot(item);
  const fields = snapshotToClickatonFields(snapshot);

  const created = await prisma.clickatonPrompt.create({
    data: {
      editionId: input.editionId,
      sequence,
      ...fields,
      inspirationSnapshot: fields.inspirationSnapshot as Prisma.InputJsonValue,
      // LOCKED: ocultas hasta eventRevealAt (maratón). DRAFT bloquea upload
      // aunque el reveal global ya haya pasado (isPromptReleasedForUpload).
      status: "LOCKED",
      assignedFromLibraryAt: new Date(),
      assignedFromLibraryByUserId: input.actorUserId ?? null,
      createdByUserId: input.actorUserId ?? null,
    },
  });

  await writeAudit(prisma, {
    libraryItemId: item.id,
    editionId: input.editionId,
    actorUserId: input.actorUserId,
    action: "ASSIGN",
    metadataJson: {
      clickatonPromptId: created.id,
      libraryVersion: snapshot.libraryVersion,
      sequence,
    },
  });

  return { prompt: created, snapshot };
}

export async function unassignFromEdition(
  params: {
    clickatonPromptId: string;
    actorUserId?: number | null;
  },
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const prompt = await prisma.clickatonPrompt.findUnique({
    where: { id: params.clickatonPromptId },
  });
  if (!prompt) throw new Error(`Prompt no encontrado: ${params.clickatonPromptId}`);

  const libraryItemId = prompt.libraryItemId;
  const editionId = prompt.editionId;

  // Desvincula biblioteca; conserva snapshots (inmutabilidad histórica).
  const updated = await prisma.clickatonPrompt.update({
    where: { id: prompt.id },
    data: {
      libraryItemId: null,
      assignedFromLibraryByUserId: null,
    },
  });

  await writeAudit(prisma, {
    libraryItemId,
    editionId,
    actorUserId: params.actorUserId,
    action: "UNASSIGN",
    metadataJson: { clickatonPromptId: prompt.id },
  });

  return updated;
}

export async function reorderEditionPrompts(
  editionId: string,
  orderedPromptIds: string[],
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  if (orderedPromptIds.length > MAX_PROMPTS_PER_EDITION) {
    throw new Error(
      `Máximo ${MAX_PROMPTS_PER_EDITION} consignas por edición.`,
    );
  }

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    select: { id: true },
  });
  const set = new Set(prompts.map((p) => p.id));
  for (const id of orderedPromptIds) {
    if (!set.has(id)) {
      throw new Error(`Prompt ${id} no pertenece a la edición ${editionId}`);
    }
  }

  // Dos pasos para evitar colisión de unique(editionId, sequence).
  await prisma.$transaction(async (tx) => {
    let offset = 1000;
    for (const id of orderedPromptIds) {
      await tx.clickatonPrompt.update({
        where: { id },
        data: { sequence: offset },
      });
      offset += 1;
    }
    let seq = 1;
    for (const id of orderedPromptIds) {
      await tx.clickatonPrompt.update({
        where: { id },
        data: { sequence: seq },
      });
      seq += 1;
    }
  });

  await writeAudit(prisma, {
    editionId,
    actorUserId,
    action: "REORDER",
    metadataJson: { orderedPromptIds },
  });

  return prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
}

/** Sugerencia determinística para armar ediciones. */
export async function suggestPrompts(
  params: { limit?: number; excludeItemIds?: string[] } = {},
  deps?: PhotoPromptLibraryDeps,
) {
  const limit = Math.min(params.limit ?? 10, MAX_PROMPTS_PER_EDITION);
  const exclude = new Set(params.excludeItemIds ?? []);
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const candidates = await db(deps).photoPromptLibraryItem.findMany({
    where: {
      status: "APPROVED",
      universal: true,
      ...(exclude.size
        ? { id: { notIn: [...exclude] } }
        : {}),
    },
    include: {
      theme: true,
      _count: { select: { assignments: true } },
      assignments: {
        where: { assignedFromLibraryAt: { gte: recentCutoff } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: "asc" }],
  });

  // Menos usados primero; evitar recientemente usados; variedad de temas.
  const ranked = [...candidates].sort((a, b) => {
    const aRecent = a.assignments.length > 0 ? 1 : 0;
    const bRecent = b.assignments.length > 0 ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    if (a._count.assignments !== b._count.assignments) {
      return a._count.assignments - b._count.assignments;
    }
    return a.id.localeCompare(b.id);
  });

  const picked: typeof ranked = [];
  const themesUsed = new Set<string>();
  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (themesUsed.has(item.themeId) && themesUsed.size < limit) {
      // Preferir variedad; si ya hay de este tema y aún hay cupo/temas, skip una pasada.
      continue;
    }
    picked.push(item);
    themesUsed.add(item.themeId);
  }
  // Completar si la variedad dejó huecos.
  if (picked.length < limit) {
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (picked.some((p) => p.id === item.id)) continue;
      picked.push(item);
    }
  }

  return picked;
}

export async function importPreviewFromPayload(
  raw: unknown,
  deps?: PhotoPromptLibraryDeps,
): Promise<ImportPreviewResult> {
  const existing = await db(deps).photoPromptLibraryItem.findMany({
    select: { id: true, title: true, normalizedTitle: true },
    take: 5000,
  });
  return importPreview(raw, existing);
}

export async function importApply(
  rows: ImportRow[],
  actorUserId?: number | null,
  deps?: PhotoPromptLibraryDeps,
) {
  const prisma = db(deps);
  const createdIds: string[] = [];

  for (const row of rows) {
    const theme = await prisma.photoPromptTheme.findUnique({
      where: { slug: row.themeSlug },
    });
    if (!theme) {
      throw new Error(`Tema no encontrado: ${row.themeSlug}`);
    }
    let subthemeId: string | null = null;
    if (row.subthemeSlug) {
      const st = await prisma.photoPromptSubtheme.findUnique({
        where: {
          themeId_slug: { themeId: theme.id, slug: row.subthemeSlug },
        },
      });
      if (!st) {
        throw new Error(
          `Subtema no encontrado: ${row.subthemeSlug} (tema ${row.themeSlug})`,
        );
      }
      subthemeId = st.id;
    }

    const item = await createItem(
      {
        title: row.title,
        description: row.description,
        themeId: theme.id,
        subthemeId,
        tags: row.tags,
        difficulty: row.difficulty,
        language: row.language,
        universal: row.universal,
        inspirationType: row.inspirationType,
        inspirationLabel: row.inspirationLabel,
        inspirationNotes: row.inspirationNotes,
        sourceKey: row.sourceKey,
        createdByUserId: actorUserId,
      },
      deps,
    );
    createdIds.push(item.id);

    await writeAudit(prisma, {
      libraryItemId: item.id,
      actorUserId,
      action: "IMPORT",
      metadataJson: { themeSlug: row.themeSlug },
    });
  }

  return { createdIds, count: createdIds.length };
}

/** Alias públicos pedidos por el brief. */
export const importPreviewService = importPreviewFromPayload;
