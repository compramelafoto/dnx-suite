/**
 * Lecturas admin del CMS Clickatón (server components y APIs).
 * Siempre con scope `platform = "clickaton"`.
 */
import {
  getAdminPostById,
  listAdminPosts,
  type AdminContentPostRow,
  type ListAdminPostsFilters,
} from "@repo/content";
import { prisma } from "@/lib/admin/db";
import { clickatonPlatformWhere } from "@/lib/content/content-platform";

export type { AdminContentPostRow, ListAdminPostsFilters };

export async function listClickatonAdminPosts(
  filters?: ListAdminPostsFilters,
): Promise<AdminContentPostRow[]> {
  return listAdminPosts({ prisma, platform: "clickaton", filters });
}

export async function getClickatonAdminPost(id: number) {
  return getAdminPostById({ prisma, platform: "clickaton", id });
}

export async function listClickatonCategories() {
  return prisma.blogCategory.findMany({
    where: clickatonPlatformWhere,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
}

export async function listClickatonTags() {
  return prisma.blogTag.findMany({
    where: clickatonPlatformWhere,
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export async function listClickatonAuthors(options?: { activeOnly?: boolean }) {
  return prisma.blogAuthor.findMany({
    where: {
      ...clickatonPlatformWhere,
      ...(options?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export async function listClickatonMedia(options?: { q?: string; limit?: number }) {
  const q = options?.q?.trim();
  return prisma.blogMedia.findMany({
    where: {
      ...clickatonPlatformWhere,
      ...(q
        ? {
            OR: [
              { filename: { contains: q, mode: "insensitive" as const } },
              { title: { contains: q, mode: "insensitive" as const } },
              { altText: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
  });
}
