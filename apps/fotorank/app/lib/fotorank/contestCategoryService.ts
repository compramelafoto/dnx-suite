import type { Prisma } from "@repo/db";
import { prisma } from "@repo/db";
import { normalizeSlug } from "./slug";
import {
  normalizeCategoryText,
  normalizeForAliasKey,
  similarityScore,
  slugifyCategoryName,
} from "./categoryNormalization";

type Tx = Prisma.TransactionClient;

const approvedGlobalWhere = {
  reviewStatus: "APPROVED" as const,
  isActive: true,
};

export async function listApprovedGlobalCategoriesForCatalog() {
  return prisma.fotorankGlobalCategory.findMany({
    where: approvedGlobalWhere,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
    },
  });
}

/** Búsqueda para autocomplete (nombre, slug, alias normalizado). */
export async function searchApprovedGlobalCategories(query: string, limit = 20) {
  const q = query.trim();
  if (!q) {
    return prisma.fotorankGlobalCategory.findMany({
      where: approvedGlobalWhere,
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true, name: true, slug: true, description: true },
    });
  }
  const norm = normalizeForAliasKey(q);
  const loose = normalizeCategoryText(q);
  return prisma.fotorankGlobalCategory.findMany({
    where: {
      ...approvedGlobalWhere,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: slugifyCategoryName(q), mode: "insensitive" } },
        { aliases: { some: { OR: [{ normalizedAlias: norm }, { normalizedAlias: { contains: norm } }] } } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, slug: true, description: true },
  });
}

export type GlobalSuggestion = {
  id: string;
  name: string;
  slug: string;
  reason: "exact_name" | "alias" | "slug" | "fuzzy";
  score: number;
};

/**
 * Sugerencias antes de crear categoría (evitar Retratos vs Retrato, B&N, etc.).
 */
export async function suggestGlobalCategoriesForInput(rawName: string, limit = 8): Promise<GlobalSuggestion[]> {
  const trimmed = rawName.trim();
  if (!trimmed) return [];

  const globals = await prisma.fotorankGlobalCategory.findMany({
    where: approvedGlobalWhere,
    select: { id: true, name: true, slug: true, aliases: { select: { normalizedAlias: true } } },
  });

  const inputNorm = normalizeCategoryText(trimmed);
  const inputAlias = normalizeForAliasKey(trimmed);
  const inputSlug = slugifyCategoryName(trimmed);

  const scored: GlobalSuggestion[] = [];

  for (const g of globals) {
    const nameNorm = normalizeCategoryText(g.name);
    const slugNorm = g.slug.toLowerCase();

    if (inputNorm === nameNorm) {
      scored.push({ id: g.id, name: g.name, slug: g.slug, reason: "exact_name", score: 1 });
      continue;
    }
    if (inputSlug && inputSlug === slugNorm) {
      scored.push({ id: g.id, name: g.name, slug: g.slug, reason: "slug", score: 0.98 });
      continue;
    }
    const aliasHit = g.aliases.some((a) => a.normalizedAlias === inputAlias || inputAlias.includes(a.normalizedAlias) || a.normalizedAlias.includes(inputAlias));
    if (aliasHit) {
      scored.push({ id: g.id, name: g.name, slug: g.slug, reason: "alias", score: 0.95 });
      continue;
    }
    const sim = Math.max(similarityScore(inputNorm, nameNorm), similarityScore(inputAlias, normalizeForAliasKey(g.name)));
    if (sim >= 0.82) {
      scored.push({ id: g.id, name: g.name, slug: g.slug, reason: "fuzzy", score: sim });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: GlobalSuggestion[] = [];
  for (const s of scored) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export async function resolveApprovedGlobalIdsByNormalizedName(tx: Tx, displayName: string): Promise<string[]> {
  const norm = normalizeCategoryText(displayName);
  const aliasKey = normalizeForAliasKey(displayName);
  if (!norm && !aliasKey) return [];

  const byName = await tx.fotorankGlobalCategory.findFirst({
    where: { ...approvedGlobalWhere, name: { equals: displayName.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return [byName.id];

  const bySlug = await tx.fotorankGlobalCategory.findFirst({
    where: { ...approvedGlobalWhere, slug: normalizeSlug(slugifyCategoryName(displayName)) || slugifyCategoryName(displayName) },
    select: { id: true },
  });
  if (bySlug) return [bySlug.id];

  const byAlias = await tx.fotorankGlobalCategoryAlias.findFirst({
    where: { normalizedAlias: aliasKey },
    include: { globalCategory: { select: { id: true, reviewStatus: true, isActive: true } } },
  });
  if (
    byAlias?.globalCategory &&
    byAlias.globalCategory.reviewStatus === "APPROVED" &&
    byAlias.globalCategory.isActive
  ) {
    return [byAlias.globalCategory.id];
  }

  const all = await tx.fotorankGlobalCategory.findMany({
    where: approvedGlobalWhere,
    select: { id: true, name: true },
  });
  const matches = all.filter((g) => normalizeCategoryText(g.name) === norm);
  if (matches.length === 1) return [matches[0]!.id];
  return [];
}

/**
 * Tras crear una fila `FotorankContestCategory`, intenta mapear a globales aprobadas por nombre/alias.
 */
export async function autoMapNewContestCategory(tx: Tx, contestCategoryId: string, displayName: string) {
  const ids = await resolveApprovedGlobalIdsByNormalizedName(tx, displayName);
  if (ids.length === 1) {
    const gid = ids[0]!;
    await tx.fotorankContestCategoryGlobalCategory.create({
      data: {
        contestCategoryId,
        globalCategoryId: gid,
        isPrimary: true,
      },
    });
    await tx.fotorankContestCategory.update({
      where: { id: contestCategoryId },
      data: {
        isCustom: false,
        mappingIncomplete: false,
        sourceGlobalCategoryId: gid,
      },
    });
    return;
  }
  await tx.fotorankContestCategory.update({
    where: { id: contestCategoryId },
    data: {
      isCustom: ids.length === 0,
      mappingIncomplete: true,
      sourceGlobalCategoryId: null,
    },
  });
}

export async function replacePivotMappings(
  tx: Tx,
  contestCategoryId: string,
  globalIds: string[],
  primaryGlobalId: string
) {
  if (!globalIds.length) throw new Error("Al menos una categoría global es obligatoria.");
  if (!globalIds.includes(primaryGlobalId)) throw new Error("La categoría principal debe estar entre las seleccionadas.");

  await tx.fotorankContestCategoryGlobalCategory.deleteMany({ where: { contestCategoryId } });
  for (const gid of globalIds) {
    await tx.fotorankContestCategoryGlobalCategory.create({
      data: {
        contestCategoryId,
        globalCategoryId: gid,
        isPrimary: gid === primaryGlobalId,
      },
    });
  }

  const allApproved = await tx.fotorankGlobalCategory.findMany({
    where: { id: { in: globalIds }, ...approvedGlobalWhere },
    select: { id: true },
  });
  const mappingIncomplete = allApproved.length !== globalIds.length;
  await tx.fotorankContestCategory.update({
    where: { id: contestCategoryId },
    data: { mappingIncomplete },
  });
}

export async function countContestEntries(contestId: string): Promise<number> {
  return prisma.fotorankContestEntry.count({ where: { contestId } });
}

export async function countContestJudgeAssignments(contestId: string): Promise<number> {
  return prisma.fotorankJudgeAssignment.count({ where: { contestId } });
}

export async function getNextContestCategorySortOrder(contestId: string): Promise<number> {
  const agg = await prisma.fotorankContestCategory.aggregate({
    where: { contestId },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

export function contestCategoryHasApprovedGlobalMapping(category: {
  globalMappings: { globalCategory: { reviewStatus: string; isActive: boolean } }[];
}): boolean {
  return category.globalMappings.some(
    (m) => m.globalCategory.reviewStatus === "APPROVED" && m.globalCategory.isActive
  );
}
