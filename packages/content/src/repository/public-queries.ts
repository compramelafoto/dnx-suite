import { BlogPostStatus, Prisma, type PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";

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

export type PublicContentPostListItem = Prisma.BlogPostGetPayload<{
  select: typeof publicPostListSelect;
}>;

/** Alias CLF. */
export type PublicBlogPostListItem = PublicContentPostListItem;

const publicPostSearchSelect = {
  ...publicPostListSelect,
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.BlogPostSelect;

export type PublicContentPostSearchItem = Prisma.BlogPostGetPayload<{
  select: typeof publicPostSearchSelect;
}>;

export type PublicBlogPostSearchItem = PublicContentPostSearchItem;

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

export type PublicContentPostDetail = Prisma.BlogPostGetPayload<{
  select: typeof publicPostDetailSelect;
}>;

export type PublicBlogPostDetail = PublicContentPostDetail;

function publishedWhereFor(platform: ContentPlatform): Prisma.BlogPostWhereInput {
  return {
    ...platformWhere(platform),
    status: BlogPostStatus.PUBLISHED,
  };
}

function indexablePublishedWhereFor(platform: ContentPlatform): Prisma.BlogPostWhereInput {
  return {
    ...publishedWhereFor(platform),
    noIndex: false,
  };
}

function featuredWhereFor(platform: ContentPlatform): Prisma.BlogPostWhereInput {
  return {
    ...publishedWhereFor(platform),
    isFeatured: true,
    OR: [{ featuredUntil: null }, { featuredUntil: { gte: new Date() } }],
  };
}

export async function listPublishedPosts(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  limit?: number;
  excludeId?: number;
}): Promise<PublicContentPostListItem[]> {
  const platform = assertContentPlatform(input.platform);
  return input.prisma.blogPost.findMany({
    where: {
      ...publishedWhereFor(platform),
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: input.limit ?? 9,
    select: publicPostListSelect,
  });
}

export async function getFeaturedPublishedPost(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
}): Promise<PublicContentPostListItem | null> {
  const platform = assertContentPlatform(input.platform);
  const featured = await input.prisma.blogPost.findFirst({
    where: featuredWhereFor(platform),
    orderBy: { publishedAt: "desc" },
    select: publicPostListSelect,
  });
  if (featured) return featured;

  return input.prisma.blogPost.findFirst({
    where: publishedWhereFor(platform),
    orderBy: { publishedAt: "desc" },
    select: publicPostListSelect,
  });
}

export async function getLatestPublishedPosts(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  limit?: number;
  excludeId?: number;
}): Promise<PublicContentPostListItem[]> {
  return listPublishedPosts(input);
}

export async function getAllPublishedPostsForHome(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
}): Promise<PublicContentPostSearchItem[]> {
  const platform = assertContentPlatform(input.platform);
  return input.prisma.blogPost.findMany({
    where: publishedWhereFor(platform),
    orderBy: { publishedAt: "desc" },
    select: publicPostSearchSelect,
  });
}

export async function getPublishedPostBySlug(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  slug: string;
}): Promise<PublicContentPostDetail | null> {
  const platform = assertContentPlatform(input.platform);
  return input.prisma.blogPost.findFirst({
    where: { ...publishedWhereFor(platform), slug: input.slug },
    select: publicPostDetailSelect,
  });
}

export async function getPublishedPostsByCategorySlug(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  categorySlug: string;
  limit?: number;
}): Promise<{
  category: { id: number; name: string; slug: string; description: string | null };
  posts: PublicContentPostListItem[];
} | null> {
  const platform = assertContentPlatform(input.platform);
  const category = await input.prisma.blogCategory.findUnique({
    where: { platform_slug: { platform, slug: input.categorySlug } },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!category) return null;

  const posts = await input.prisma.blogPost.findMany({
    where: { ...indexablePublishedWhereFor(platform), categoryId: category.id },
    orderBy: { publishedAt: "desc" },
    take: input.limit ?? 50,
    select: publicPostListSelect,
  });

  return { category, posts };
}

export async function getPublishedPostsByTagSlug(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  tagSlug: string;
  limit?: number;
}): Promise<{
  tag: { id: number; name: string; slug: string };
  posts: PublicContentPostListItem[];
} | null> {
  const platform = assertContentPlatform(input.platform);
  const tag = await input.prisma.blogTag.findUnique({
    where: { platform_slug: { platform, slug: input.tagSlug } },
    select: { id: true, name: true, slug: true },
  });
  if (!tag) return null;

  const posts = await input.prisma.blogPost.findMany({
    where: {
      ...indexablePublishedWhereFor(platform),
      tags: { some: { tagId: tag.id } },
    },
    orderBy: { publishedAt: "desc" },
    take: input.limit ?? 50,
    select: publicPostListSelect,
  });

  return { tag, posts };
}

export async function listCategoriesForHome(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
}) {
  const platform = assertContentPlatform(input.platform);
  const publishedWhere = publishedWhereFor(platform);
  return input.prisma.blogCategory.findMany({
    where: platformWhere(platform),
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

export function mapPublicPostTags(post: PublicContentPostDetail) {
  return post.tags.map((row) => row.tag);
}
