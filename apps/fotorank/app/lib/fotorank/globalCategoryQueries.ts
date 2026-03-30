import { prisma } from "@repo/db";

/**
 * Queries orientadas a ranking global y estadísticas (base reutilizable).
 */

export async function listEntryIdsByGlobalCategory(params: {
  globalCategoryId: string;
  contestId?: string;
}): Promise<string[]> {
  const rows = await prisma.fotorankContestEntry.findMany({
    where: {
      ...(params.contestId ? { contestId: params.contestId } : {}),
      category: {
        globalMappings: {
          some: { globalCategoryId: params.globalCategoryId },
        },
      },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function countEntriesByGlobalCategoryPerContest(globalCategoryId: string) {
  const rows = await prisma.fotorankContestEntry.groupBy({
    by: ["contestId"],
    where: {
      category: {
        globalMappings: {
          some: { globalCategoryId },
        },
      },
    },
    _count: { _all: true },
  });
  return rows.map((r) => ({ contestId: r.contestId, count: r._count._all }));
}

export async function countEntriesPerGlobalCategoryInContest(contestId: string) {
  const mappings = await prisma.fotorankContestCategoryGlobalCategory.findMany({
    where: {
      contestCategory: { contestId, status: "ACTIVE" },
      globalCategory: { reviewStatus: "APPROVED", isActive: true },
    },
    select: {
      globalCategoryId: true,
      contestCategory: {
        select: {
          _count: { select: { entries: true } },
        },
      },
    },
  });

  const byGlobal = new Map<string, number>();
  for (const m of mappings) {
    const n = m.contestCategory._count.entries;
    byGlobal.set(m.globalCategoryId, (byGlobal.get(m.globalCategoryId) ?? 0) + n);
  }

  const globals = await prisma.fotorankGlobalCategory.findMany({
    where: { id: { in: [...byGlobal.keys()] } },
    select: { id: true, name: true, slug: true },
  });

  return globals.map((g) => ({
    globalCategoryId: g.id,
    name: g.name,
    slug: g.slug,
    entryCount: byGlobal.get(g.id) ?? 0,
  }));
}
