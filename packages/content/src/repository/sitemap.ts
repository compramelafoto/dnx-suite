import { BlogPostStatus, type PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";

export async function getContentSitemapEntries(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
}) {
  const platform = assertContentPlatform(input.platform);
  const publishedScoped = {
    ...platformWhere(platform),
    status: BlogPostStatus.PUBLISHED,
    noIndex: false,
  } as const;

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
        ...platformWhere(platform),
        posts: {
          some: publishedScoped,
        },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    input.prisma.blogTag.findMany({
      where: {
        ...platformWhere(platform),
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
