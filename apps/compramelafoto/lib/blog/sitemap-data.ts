import { BlogPostStatus } from "@prisma/client";
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
  const [posts, categories, tags] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
        status: BlogPostStatus.PUBLISHED,
        noIndex: false,
      },
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
        posts: {
          some: {
            status: BlogPostStatus.PUBLISHED,
            noIndex: false,
          },
        },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.blogTag.findMany({
      where: {
        posts: {
          some: {
            post: {
              status: BlogPostStatus.PUBLISHED,
              noIndex: false,
            },
          },
        },
      },
      select: { slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { posts, categories, tags };
}
