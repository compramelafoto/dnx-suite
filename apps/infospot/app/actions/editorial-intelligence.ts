/**
 * Enriquecimiento async (duplicados / relacionados) — solo lectura Prisma.
 */

"use server";

import { prisma } from "@repo/db";
import type { EditorialRelatedHit } from "@repo/editorial-intelligence";
import { publicPublishedArticleWhere } from "@/lib/distribution/public-rules";

function tokenize(title: string): string[] {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);
}

export async function fetchEditorialAssistantContextAction(input: {
  articleId?: string | null;
  title: string;
  categoryId?: string | null;
  city?: string | null;
  province?: string | null;
}): Promise<{
  relatedHits: EditorialRelatedHit[];
  duplicateHits: EditorialRelatedHit[];
  linkHits: EditorialRelatedHit[];
}> {
  const title = input.title.trim();
  if (title.length < 6) {
    return { relatedHits: [], duplicateHits: [], linkHits: [] };
  }

  const tokens = tokenize(title);
  const orTitle =
    tokens.length > 0
      ? tokens.map((t) => ({ title: { contains: t, mode: "insensitive" as const } }))
      : [{ title: { contains: title.slice(0, 24), mode: "insensitive" as const } }];

  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      ...publicPublishedArticleWhere(),
      ...(input.articleId ? { id: { not: input.articleId } } : {}),
      OR: [
        ...orTitle,
        ...(input.categoryId ? [{ categoryId: input.categoryId }] : []),
        ...(input.city
          ? [{ city: { equals: input.city, mode: "insensitive" as const } }]
          : []),
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      province: true,
      categoryId: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 12,
  });

  const relatedHits: EditorialRelatedHit[] = articles.map((a) => ({
    id: a.id,
    title: a.title,
    url: `/noticias/${a.slug}`,
    kind: "article" as const,
  }));

  const titleNorm = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const duplicateHits = relatedHits.filter((h) => {
    const n = h.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (n === titleNorm) return true;
    const shared = tokenize(h.title).filter((t) => tokens.includes(t));
    return shared.length >= Math.min(3, tokens.length);
  });

  const linkHits = relatedHits.slice(0, 5);

  // Eventos cercanos por ciudad (relacionados).
  if (input.city?.trim()) {
    const events = await prisma.infoSpotEvent.findMany({
      where: {
        status: "PUBLISHED",
        city: { equals: input.city, mode: "insensitive" },
        startAt: { gte: new Date(Date.now() - 7 * 864e5) },
      },
      select: { id: true, title: true, slug: true },
      orderBy: { startAt: "asc" },
      take: 4,
    });
    for (const e of events) {
      relatedHits.push({
        id: e.id,
        title: e.title,
        url: `/eventos/${e.slug}`,
        kind: "event",
      });
    }
  }

  return { relatedHits, duplicateHits, linkHits };
}
