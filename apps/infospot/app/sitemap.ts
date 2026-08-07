import type { MetadataRoute } from "next";
import { prisma } from "@repo/db";
import { getSiteUrl } from "@/lib/settings";

function staticSitemap(base: string): MetadataRoute.Sitemap {
  return [
    "",
    "/noticias",
    "/eventos",
    "/publicar-evento",
    "/quienes-somos",
    "/colaboradores",
    "/contacto",
    "/privacidad",
    "/terminos",
    "/politica-editorial",
    "/categorias/deportes",
    "/categorias/cultura",
    "/categorias/fotografia",
  ].map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: path === "" ? ("hourly" as const) : ("daily" as const),
    priority: path === "" ? 1 : 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const staticRoutes = staticSitemap(base);

  // Preview / build sin DATABASE_URL: no tumbar `next build`.
  if (!process.env.DATABASE_URL?.trim()) {
    return staticRoutes;
  }

  try {
    const [articles, events, categories] = await Promise.all([
      prisma.infoSpotArticle.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
        take: 500,
      }),
      prisma.infoSpotEvent.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
        take: 500,
      }),
      prisma.infoSpotCategory.findMany({
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...categories.map((c) => ({
        url: `${base}/categorias/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...articles.map((a) => ({
        url: `${base}/noticias/${a.slug}`,
        lastModified: a.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...events.map((e) => ({
        url: `${base}/eventos/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      /Environment variable not found: DATABASE_URL/i.test(message) ||
      /PrismaClientInitializationError/i.test(message)
    ) {
      return staticRoutes;
    }
    throw err;
  }
}
