import { BlogPostStatus, type PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";

export async function getContentSitemapEntries(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  workspaceKey?: string | null;
  now?: Date;
}) {
  const platform = assertContentPlatform(input.platform);
  const scope = platformWhere(platform, input.workspaceKey);
  const now = input.now ?? new Date();
  const publishedScoped = {
    ...scope,
    status: BlogPostStatus.PUBLISHED,
    noIndex: false,
    // Programado: con fecha futura todavía no está publicado.
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };

  const [posts, categories, tags] = await Promise.all([
    input.prisma.blogPost.findMany({
      where: publishedScoped,
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        lastReviewedAt: true,
      },
      orderBy: { publishedAt: "desc" },
    }),
    input.prisma.blogCategory.findMany({
      where: {
        ...scope,
        posts: {
          some: publishedScoped,
        },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    input.prisma.blogTag.findMany({
      where: {
        ...scope,
        posts: {
          some: {
            post: publishedScoped,
          },
        },
      },
      select: { slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { posts, categories, tags };
}
