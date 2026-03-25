import { prisma } from "@repo/db";
import type { UserOrganization } from "./organizations";

export type FotorankContestListItem = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  status: string;
  visibility: string;
  createdAt: Date;
  categoriesCount: number;
};

/**
 * Obtiene los concursos FotoRank de una organización.
 */
export async function getFotorankContests(organizationId: string): Promise<FotorankContestListItem[]> {
  const contests = await prisma.fotorankContest.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { categories: true } },
    },
  });

  return contests.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription,
    status: c.status,
    visibility: c.visibility,
    createdAt: c.createdAt,
    categoriesCount: c._count.categories,
  }));
}

/**
 * Obtiene un concurso FotoRank por ID.
 */
export async function getFotorankContestById(id: string) {
  return prisma.fotorankContest.findUnique({
    where: { id },
    include: {
      organization: true,
      categories: { orderBy: { sortOrder: "asc" } },
    },
  });
}
