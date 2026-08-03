import { BlogPostStatus } from "@prisma/client";
import { clfPlatformWhere } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

/** Rutas estáticas públicas relevantes para SEO. */
export const PUBLIC_STATIC_SITEMAP_PATHS = [
  "",
  "/blog",
  "/tutoriales",
  "/terminos",
  "/privacidad",
  "/escuelas",
  "/directorio/fotografos",
  "/recomendanos",
] as const;

export async function getBlogSitemapEntries() {
  const publishedClf = {
    ...clfPlatformWhere,
    status: BlogPostStatus.PUBLISHED,
    noIndex: false,
  } as const;

  const [posts, categories, tags] = await Promise.all([
    prisma.blogPost.findMany({
      where: publishedClf,
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        lastReviewedAt: true,
      },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.blogCategory.findMany({
      where: {
        ...clfPlatformWhere,
        posts: {
          some: publishedClf,
        },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.blogTag.findMany({
      where: {
        ...clfPlatformWhere,
        posts: {
          some: {
            post: publishedClf,
          },
        },
      },
      select: { slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { posts, categories, tags };
}
