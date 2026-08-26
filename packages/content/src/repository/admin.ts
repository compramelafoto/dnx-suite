import type { PrismaClient } from "@prisma/client";
import { assertContentPlatform, platformWhere, type ContentPlatform } from "../platform";
import { contentPostInclude, mapContentPostResponse } from "./post-include";

const adminPostListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  type: true,
  isFeatured: true,
  publishedAt: true,
  viewCount: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, slug: true } },
} as const;

export type AdminContentPostRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  type: string;
  isFeatured: boolean;
  publishedAt: string | null;
  viewCount: number;
  category: { id: number; name: string; slug: string } | null;
  author: { id: number; name: string; slug: string } | null;
};

export type ListAdminPostsFilters = {
  status?: string | null;
  type?: string | null;
  q?: string | null;
};

export async function listAdminPosts(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  filters?: ListAdminPostsFilters;
}): Promise<AdminContentPostRow[]> {
  const platform = assertContentPlatform(input.platform);
  const filters = input.filters ?? {};
  const q = filters.q?.trim();

  const posts = await input.prisma.blogPost.findMany({
    where: {
      ...platformWhere(platform),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: adminPostListSelect,
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    type: post.type,
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    viewCount: post.viewCount,
    category: post.category,
    author: post.author,
  }));
}

export async function getAdminPostById(input: {
  prisma: PrismaClient;
  platform: ContentPlatform;
  id: number;
}) {
  const platform = assertContentPlatform(input.platform);
  const post = await input.prisma.blogPost.findFirst({
    where: { id: input.id, ...platformWhere(platform) },
    include: contentPostInclude,
  });
  if (!post) return null;
  return mapContentPostResponse(post);
}
