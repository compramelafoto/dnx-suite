import { BlogPostStatus, Prisma } from "@prisma/client";
import { CLF_CONTENT_PLATFORM, clfPlatformWhere } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

export const publicPostListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  heroImageUrl: true,
  publishedAt: true,
  readingTimeMin: true,
  type: true,
  isFeatured: true,
  viewCount: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.BlogPostSelect;

export type PublicBlogPostListItem = Prisma.BlogPostGetPayload<{
  select: typeof publicPostListSelect;
}>;

const publicPostSearchSelect = {
  ...publicPostListSelect,
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.BlogPostSelect;

export type PublicBlogPostSearchItem = Prisma.BlogPostGetPayload<{
  select: typeof publicPostSearchSelect;
}>;

export const publicPostDetailSelect = {
  ...publicPostListSelect,
  contentHtml: true,
  seoGoal: true,
  seoTitle: true,
  seoDescription: true,
  ogImageUrl: true,
  canonicalUrl: true,
  noIndex: true,
  updatedAt: true,
  lastReviewedAt: true,
  tags: {
    include: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.BlogPostSelect;

export type PublicBlogPostDetail = Prisma.BlogPostGetPayload<{
  select: typeof publicPostDetailSelect;
}>;

const publishedWhere: Prisma.BlogPostWhereInput = {
  ...clfPlatformWhere,
  status: BlogPostStatus.PUBLISHED,
};

/** Publicado e indexable en listados de categoría/tag. */
const indexablePublishedWhere: Prisma.BlogPostWhereInput = {
  ...publishedWhere,
  noIndex: false,
};

const featuredWhere: Prisma.BlogPostWhereInput = {
  ...publishedWhere,
  isFeatured: true,
  OR: [{ featuredUntil: null }, { featuredUntil: { gte: new Date() } }],
};

export async function getFeaturedPublishedPost(): Promise<PublicBlogPostListItem | null> {
  const featured = await prisma.blogPost.findFirst({
    where: featuredWhere,
    orderBy: { publishedAt: "desc" },
    select: publicPostListSelect,
  });
  if (featured) return featured;

  return prisma.blogPost.findFirst({
    where: publishedWhere,
    orderBy: { publishedAt: "desc" },
    select: publicPostListSelect,
  });
}

export async function getLatestPublishedPosts(
  limit = 9,
  excludeId?: number
): Promise<PublicBlogPostListItem[]> {
  return prisma.blogPost.findMany({
    where: {
      ...publishedWhere,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: publicPostListSelect,
  });
}

/** Todos los publicados para búsqueda rápida en la home del blog. */
export async function getAllPublishedPostsForBlogHome(): Promise<PublicBlogPostSearchItem[]> {
  return prisma.blogPost.findMany({
    where: publishedWhere,
    orderBy: { publishedAt: "desc" },
    select: publicPostSearchSelect,
  });
}

export async function getPublishedPostsByCategorySlug(
  categorySlug: string,
  limit = 50
): Promise<{ category: { id: number; name: string; slug: string; description: string | null }; posts: PublicBlogPostListItem[] } | null> {
  const category = await prisma.blogCategory.findUnique({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: categorySlug } },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!category) return null;

  const posts = await prisma.blogPost.findMany({
    where: { ...indexablePublishedWhere, categoryId: category.id },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: publicPostListSelect,
  });

  return { category, posts };
}

export async function getPublishedPostsByTagSlug(
  tagSlug: string,
  limit = 50
): Promise<{ tag: { id: number; name: string; slug: string }; posts: PublicBlogPostListItem[] } | null> {
  const tag = await prisma.blogTag.findUnique({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: tagSlug } },
    select: { id: true, name: true, slug: true },
  });
  if (!tag) return null;

  const posts = await prisma.blogPost.findMany({
    where: {
      ...indexablePublishedWhere,
      tags: { some: { tagId: tag.id } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: publicPostListSelect,
  });

  return { tag, posts };
}

export async function getPublishedPostBySlug(slug: string): Promise<PublicBlogPostDetail | null> {
  return prisma.blogPost.findFirst({
    where: { ...publishedWhere, slug },
    select: publicPostDetailSelect,
  });
}

export async function getBlogCategoriesForHome() {
  return prisma.blogCategory.findMany({
    where: clfPlatformWhere,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          posts: {
            where: publishedWhere,
          },
        },
      },
    },
  });
}

export function mapPublicPostTags(post: PublicBlogPostDetail) {
  return post.tags.map((row) => row.tag);
}
