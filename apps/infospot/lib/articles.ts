import { prisma, type Prisma } from "@repo/db";
import type { ArticleStatus } from "@/lib/article-status";

export const articleListInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, email: true } },
  coverImage: {
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      caption: true,
      credit: true,
      photographerName: true,
      copyrightText: true,
    },
  },
  articleAssets: {
    orderBy: [{ usageType: "asc" as const }, { sortOrder: "asc" as const }],
    select: {
      id: true,
      usageType: true,
      sortOrder: true,
      captionOverride: true,
      asset: {
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          caption: true,
          credit: true,
          photographerName: true,
          copyrightText: true,
          sourceType: true,
        },
      },
    },
  },
} satisfies Prisma.InfoSpotArticleInclude;

export type ArticleWithRelations = Prisma.InfoSpotArticleGetPayload<{
  include: typeof articleListInclude;
}>;

/** Solo contenido REAL en superficies públicas (DEMO / NEEDS_REVIEW no salen). */
const publicArticleWhere = {
  status: "PUBLISHED" as const,
  contentTag: "REAL" as const,
};

export async function getPublishedArticles(options?: {
  take?: number;
  skip?: number;
  categorySlug?: string;
}) {
  const take = options?.take ?? 24;
  const skip = options?.skip ?? 0;
  return prisma.infoSpotArticle.findMany({
    where: {
      ...publicArticleWhere,
      ...(options?.categorySlug
        ? { category: { slug: options.categorySlug } }
        : {}),
    },
    include: articleListInclude,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take,
    skip,
  });
}

export async function getPublishedArticleBySlug(slug: string) {
  return prisma.infoSpotArticle.findFirst({
    where: { slug, ...publicArticleWhere },
    include: articleListInclude,
  });
}

export async function getArticleByIdForEditor(id: string) {
  return prisma.infoSpotArticle.findUnique({
    where: { id },
    include: articleListInclude,
  });
}

export async function getEditorialDashboardStats() {
  const [draft, published, unpublished, archived, total] = await Promise.all([
    prisma.infoSpotArticle.count({ where: { status: "DRAFT" } }),
    prisma.infoSpotArticle.count({ where: { status: "PUBLISHED" } }),
    prisma.infoSpotArticle.count({ where: { status: "UNPUBLISHED" } }),
    prisma.infoSpotArticle.count({ where: { status: "ARCHIVED" } }),
    prisma.infoSpotArticle.count(),
  ]);
  return { draft, published, unpublished, archived, total };
}

export async function listArticlesForRedaccion(status?: ArticleStatus | "ALL") {
  return prisma.infoSpotArticle.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    include: articleListInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });
}

export async function getCategories() {
  return prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.infoSpotCategory.findUnique({ where: { slug } });
}

export async function getHomeEditorialData() {
  const [featured, latest, categories] = await Promise.all([
    prisma.infoSpotArticle.findFirst({
      where: publicArticleWhere,
      include: articleListInclude,
      // Portada = más reciente REAL publicada (configurable a futuro).
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    }),
    getPublishedArticles({ take: 16 }),
    prisma.infoSpotCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        articles: {
          where: publicArticleWhere,
          include: articleListInclude,
          orderBy: [{ publishedAt: "desc" }],
          take: 4,
        },
      },
    }),
  ]);
  return { featured, latest, categories };
}

/** Orden preferido de bloques de categoría en portada (solo si existen y tienen notas). */
export const HOME_CATEGORY_ORDER = [
  "deportes",
  "cultura",
  "fotografia",
  "eventos",
] as const;

export async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let candidate = baseSlug || "noticia";
  let n = 0;
  while (true) {
    const existing = await prisma.infoSpotArticle.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
    candidate = `${baseSlug}-${n}`;
  }
}

export async function listUploadAssets(take = 40) {
  return prisma.infoSpotEditorialAsset.findMany({
    where: { sourceType: "UPLOAD" },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function authorDisplayName(author: { name: string | null; email: string }): string {
  return author.name?.trim() || author.email;
}
