"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { normalizeSlug } from "../lib/fotorank/slug";
import { slugifyCategoryName } from "../lib/fotorank/categoryNormalization";
import {
  canBulkReplaceContestCategories,
  getCategoryManagementMode,
  canChangeContestCategorySlug,
  canEditGlobalMappings,
} from "../lib/fotorank/contestCategoryPolicy";
import {
  countContestJudgeAssignments,
  getNextContestCategorySortOrder,
  listApprovedGlobalCategoriesForCatalog,
  replacePivotMappings,
  searchApprovedGlobalCategories,
  suggestGlobalCategoriesForInput,
} from "../lib/fotorank/contestCategoryService";
import { routes } from "../lib/routes";

async function loadContestForOrg(contestId: string) {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false as const, error: org.error };
  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.org.id },
    include: {
      _count: { select: { entries: true } },
    },
  });
  if (!contest) return { ok: false as const, error: "Concurso no encontrado." };
  return { ok: true as const, user, contest };
}

function revalidateContest(contestId: string, slug?: string) {
  revalidatePath(routes.concursos.index());
  revalidatePath(routes.dashboard.concursos.detalle(contestId));
  if (slug) revalidatePath(routes.concursos.publico(slug));
}

export async function listGlobalCategoriesCatalogAction(): Promise<
  { ok: true; items: Awaited<ReturnType<typeof listApprovedGlobalCategoriesForCatalog>> } | { ok: false; error: string }
> {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, error: org.error };
  const items = await listApprovedGlobalCategoriesForCatalog();
  return { ok: true, items };
}

export async function searchGlobalCategoriesAction(
  query: string
): Promise<{ ok: true; items: Awaited<ReturnType<typeof searchApprovedGlobalCategories>> } | { ok: false; error: string }> {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, error: org.error };
  const items = await searchApprovedGlobalCategories(query, 25);
  return { ok: true, items };
}

export async function suggestSimilarCategoriesAction(name: string): Promise<
  { ok: true; suggestions: Awaited<ReturnType<typeof suggestGlobalCategoriesForInput>> } | { ok: false; error: string }
> {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, error: org.error };
  const suggestions = await suggestGlobalCategoriesForInput(name, 10);
  return { ok: true, suggestions };
}

export async function addContestCategoryFromGlobalAction(input: {
  contestId: string;
  globalCategoryId: string;
  displayName?: string;
  maxFiles?: number;
}): Promise<{ ok: true; categoryId: string } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se pueden editar categorías en este estado." };

  const globalCat = await prisma.fotorankGlobalCategory.findFirst({
    where: {
      id: input.globalCategoryId,
      reviewStatus: "APPROVED",
      isActive: true,
    },
  });
  if (!globalCat) return { ok: false, error: "Categoría global no disponible." };

  const display = (input.displayName?.trim() || globalCat.name).trim();
  const baseSlug = normalizeSlug(slugifyCategoryName(display)) || globalCat.slug;
  let slug = baseSlug;
  let n = 0;
  while (
    await prisma.fotorankContestCategory.findUnique({
      where: { contestId_slug: { contestId: input.contestId, slug } },
    })
  ) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const sortOrder = await getNextContestCategorySortOrder(input.contestId);
  const maxFiles = Math.max(1, input.maxFiles ?? 1);

  const created = await prisma.$transaction(async (tx) => {
    const cat = await tx.fotorankContestCategory.create({
      data: {
        contestId: input.contestId,
        name: display,
        slug,
        maxFiles,
        sortOrder,
        status: "ACTIVE",
        isCustom: false,
        sourceGlobalCategoryId: globalCat.id,
        mappingIncomplete: false,
      },
    });
    await tx.fotorankContestCategoryGlobalCategory.create({
      data: {
        contestCategoryId: cat.id,
        globalCategoryId: globalCat.id,
        isPrimary: true,
      },
    });
    return cat;
  });

  revalidateContest(input.contestId, contest.slug);
  return { ok: true, categoryId: created.id };
}

export async function addContestCategoryCustomAction(input: {
  contestId: string;
  displayName: string;
  description?: string;
  maxFiles?: number;
  globalCategoryIds: string[];
  primaryGlobalCategoryId: string;
}): Promise<{ ok: true; categoryId: string } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se pueden editar categorías en este estado." };

  const display = input.displayName.trim();
  if (!display) return { ok: false, error: "El nombre visible es obligatorio." };
  if (!input.globalCategoryIds.length) return { ok: false, error: "Elegí al menos una categoría global para el mapeo." };
  if (!input.globalCategoryIds.includes(input.primaryGlobalCategoryId)) {
    return { ok: false, error: "La categoría principal debe estar entre las globales seleccionadas." };
  }

  const approved = await prisma.fotorankGlobalCategory.findMany({
    where: {
      id: { in: input.globalCategoryIds },
      reviewStatus: "APPROVED",
      isActive: true,
    },
    select: { id: true },
  });
  if (approved.length !== input.globalCategoryIds.length) {
    return { ok: false, error: "Solo se permiten categorías globales aprobadas y activas." };
  }

  const baseSlug = normalizeSlug(slugifyCategoryName(display)) || `cat-${Date.now()}`;
  let slug = baseSlug;
  let n = 0;
  while (
    await prisma.fotorankContestCategory.findUnique({
      where: { contestId_slug: { contestId: input.contestId, slug } },
    })
  ) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const sortOrder = await getNextContestCategorySortOrder(input.contestId);
  const maxFiles = Math.max(1, input.maxFiles ?? 1);

  const created = await prisma.$transaction(async (tx) => {
    const cat = await tx.fotorankContestCategory.create({
      data: {
        contestId: input.contestId,
        name: display,
        slug,
        description: input.description?.trim() || null,
        maxFiles,
        sortOrder,
        status: "ACTIVE",
        isCustom: true,
        mappingIncomplete: false,
        sourceGlobalCategoryId: null,
      },
    });
    await replacePivotMappings(tx, cat.id, input.globalCategoryIds, input.primaryGlobalCategoryId);
    return cat;
  });

  revalidateContest(input.contestId, contest.slug);
  return { ok: true, categoryId: created.id };
}

export async function suggestGlobalCategoryForSystemAction(input: {
  contestId: string;
  suggestedName: string;
  description?: string;
  parentGlobalId?: string;
  reason?: string;
  provisionalGlobalCategoryIds: string[];
  primaryProvisionalGlobalId: string;
  contestDisplayName?: string;
  contestMaxFiles?: number;
}): Promise<{ ok: true; pendingGlobalId: string; contestCategoryId: string } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { user, contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se pueden editar categorías en este estado." };

  const name = input.suggestedName.trim();
  if (!name) return { ok: false, error: "El nombre sugerido es obligatorio." };
  if (!input.provisionalGlobalCategoryIds.length) {
    return { ok: false, error: "Mientras la sugerencia se revisa, debés mapear a categorías globales existentes." };
  }
  if (!input.provisionalGlobalCategoryIds.includes(input.primaryProvisionalGlobalId)) {
    return { ok: false, error: "La categoría global principal provisional es obligatoria." };
  }

  const dup = await suggestGlobalCategoriesForInput(name, 3);
  if (dup.some((d) => d.reason === "exact_name" || d.score >= 0.98)) {
    return {
      ok: false,
      error: "Ya existe una categoría global muy similar. Usá «Categoría existente» o «Personalizada» con mapeo.",
    };
  }

  const approved = await prisma.fotorankGlobalCategory.findMany({
    where: {
      id: { in: input.provisionalGlobalCategoryIds },
      reviewStatus: "APPROVED",
      isActive: true,
    },
  });
  if (approved.length !== input.provisionalGlobalCategoryIds.length) {
    return { ok: false, error: "Las categorías globales provisionales deben estar aprobadas." };
  }

  let slug = normalizeSlug(slugifyCategoryName(name)) || `global-sugerida-${Date.now()}`;
  let suf = 0;
  while (await prisma.fotorankGlobalCategory.findUnique({ where: { slug } })) {
    suf += 1;
    slug = `${normalizeSlug(slugifyCategoryName(name))}-${suf}`;
  }

  const displayName = (input.contestDisplayName?.trim() || name).trim();
  let catSlug = normalizeSlug(slugifyCategoryName(displayName)) || slug;
  let n = 0;
  while (
    await prisma.fotorankContestCategory.findUnique({
      where: { contestId_slug: { contestId: input.contestId, slug: catSlug } },
    })
  ) {
    n += 1;
    catSlug = `${normalizeSlug(slugifyCategoryName(displayName))}-${n}`;
  }

  const result = await prisma.$transaction(async (tx) => {
    const pending = await tx.fotorankGlobalCategory.create({
      data: {
        name,
        slug,
        description: input.description?.trim() || null,
        parentId: input.parentGlobalId?.trim() || null,
        isActive: false,
        isSystem: false,
        reviewStatus: "PENDING",
        suggestedByUserId: user.id,
        suggestionReason: input.reason?.trim() || null,
      },
    });

    const sortOrder = await getNextContestCategorySortOrder(input.contestId);
    const cat = await tx.fotorankContestCategory.create({
      data: {
        contestId: input.contestId,
        name: displayName,
        slug: catSlug,
        maxFiles: Math.max(1, input.contestMaxFiles ?? 1),
        sortOrder,
        status: "ACTIVE",
        isCustom: true,
        linkedPendingGlobalCategoryId: pending.id,
        mappingIncomplete: false,
      },
    });

    await replacePivotMappings(tx, cat.id, input.provisionalGlobalCategoryIds, input.primaryProvisionalGlobalId);
    return { pending, cat };
  });

  revalidateContest(input.contestId, contest.slug);
  return { ok: true, pendingGlobalId: result.pending.id, contestCategoryId: result.cat.id };
}

export async function updateContestCategoryMappingsAction(input: {
  contestId: string;
  categoryId: string;
  globalCategoryIds: string[];
  primaryGlobalCategoryId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (!canEditGlobalMappings(mode)) return { ok: false, error: "No se puede editar el mapeo en este estado." };

  const cat = await prisma.fotorankContestCategory.findFirst({
    where: { id: input.categoryId, contestId: input.contestId },
  });
  if (!cat) return { ok: false, error: "Categoría no encontrada." };

  try {
    await prisma.$transaction(async (tx) => {
      await replacePivotMappings(tx, cat.id, input.globalCategoryIds, input.primaryGlobalCategoryId);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar mapeo.";
    return { ok: false, error: msg };
  }

  revalidateContest(input.contestId, contest.slug);
  return { ok: true };
}

export async function updateContestCategoryFieldsAction(input: {
  contestId: string;
  categoryId: string;
  name?: string;
  description?: string | null;
  maxFiles?: number;
  slug?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se puede editar." };

  const cat = await prisma.fotorankContestCategory.findFirst({
    where: { id: input.categoryId, contestId: input.contestId },
    include: { _count: { select: { entries: true } } },
  });
  if (!cat) return { ok: false, error: "Categoría no encontrada." };

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.maxFiles !== undefined) data.maxFiles = Math.max(1, input.maxFiles);

  if (input.slug !== undefined) {
    if (!canChangeContestCategorySlug(mode, cat._count.entries)) {
      return { ok: false, error: "No se puede cambiar el slug si ya hay obras en esta categoría." };
    }
    const s = normalizeSlug(input.slug);
    if (!s) return { ok: false, error: "Slug no válido." };
    const clash = await prisma.fotorankContestCategory.findFirst({
      where: { contestId: input.contestId, slug: s, id: { not: cat.id } },
    });
    if (clash) return { ok: false, error: "Ese slug ya existe en el concurso." };
    data.slug = s;
  }

  if (Object.keys(data).length === 0) return { ok: true };
  await prisma.fotorankContestCategory.update({ where: { id: cat.id }, data });
  revalidateContest(input.contestId, contest.slug);
  return { ok: true };
}

export async function reorderContestCategoriesAction(input: {
  contestId: string;
  orderedCategoryIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se puede reordenar." };

  const existing = await prisma.fotorankContestCategory.findMany({
    where: { contestId: input.contestId },
    select: { id: true },
  });
  const set = new Set(existing.map((e) => e.id));
  if (input.orderedCategoryIds.length !== set.size) return { ok: false, error: "Lista de categorías incompleta." };
  for (const id of input.orderedCategoryIds) {
    if (!set.has(id)) return { ok: false, error: "ID de categoría inválido." };
  }

  await prisma.$transaction(
    input.orderedCategoryIds.map((id, sortOrder) =>
      prisma.fotorankContestCategory.update({
        where: { id },
        data: { sortOrder },
      })
    )
  );

  revalidateContest(input.contestId, contest.slug);
  return { ok: true };
}

export async function archiveContestCategoryAction(input: {
  contestId: string;
  categoryId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadContestForOrg(input.contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;

  const mode = getCategoryManagementMode(contest.status, contest._count.entries > 0);
  if (mode === "readonly") return { ok: false, error: "No se puede archivar." };

  const cat = await prisma.fotorankContestCategory.findFirst({
    where: { id: input.categoryId, contestId: input.contestId },
    include: { _count: { select: { entries: true, judgeAssignments: true } } },
  });
  if (!cat) return { ok: false, error: "Categoría no encontrada." };
  if (cat._count.entries > 0 || cat._count.judgeAssignments > 0) {
    return {
      ok: false,
      error: "No se puede archivar una categoría con obras o asignaciones de jurado. Reasigná antes o contactá soporte.",
    };
  }

  await prisma.fotorankContestCategory.update({
    where: { id: cat.id },
    data: { status: "ARCHIVED" },
  });

  revalidateContest(input.contestId, contest.slug);
  return { ok: true };
}

/** Reemplazo masivo (solo borrador sin obras ni asignaciones). Usado por modal legacy / wizard. */
export async function assertCanBulkReplaceCategories(contestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await loadContestForOrg(contestId);
  if (!r.ok) return { ok: false, error: r.error };
  const { contest } = r;
  const assignmentCount = await countContestJudgeAssignments(contestId);
  if (
    !canBulkReplaceContestCategories({
      contestDbStatus: contest.status,
      entryCount: contest._count.entries,
      assignmentCount,
    })
  ) {
    return {
      ok: false,
      error:
        "No se puede reemplazar todo el listado: hay obras o jurados asignados, o el concurso está cerrado/archivado. Usá la gestión por categoría (agregar / archivar / mapeo).",
    };
  }
  return { ok: true };
}
