import "server-only";
import { prisma } from "@repo/db";
import {
  createContentPost,
  deleteContentPost,
  getAdminPostById,
  listAdminPosts,
  mapContentPostResponse,
  updateContentPost,
  type AdminContentPostRow,
  type ContentPostCreateInput,
  type ContentPostUpdateInput,
  type ListAdminPostsFilters,
} from "@repo/content";
import { blogScope, blogWhere } from "./scope";

/**
 * Lecturas y escrituras del panel del blog de una institución.
 *
 * Todo recibe el `workspaceId` de la sesión —nunca del cliente— y pasa por `blogScope` /
 * `blogWhere`: así una institución no puede ver ni tocar el blog de otra aunque adivine un id.
 */
export type { AdminContentPostRow, ListAdminPostsFilters };
export { mapContentPostResponse };

export function listBlogAdminPosts(workspaceId: string, filters?: ListAdminPostsFilters) {
  return listAdminPosts({ ...blogScope(workspaceId), filters });
}

export function getBlogAdminPost(workspaceId: string, id: number) {
  return getAdminPostById({ ...blogScope(workspaceId), id });
}

export function createBlogPost(workspaceId: string, data: ContentPostCreateInput) {
  return createContentPost({ ...blogScope(workspaceId), data });
}

export function updateBlogPost(workspaceId: string, postId: number, data: ContentPostUpdateInput) {
  return updateContentPost({ ...blogScope(workspaceId), postId, data });
}

export function deleteBlogPost(workspaceId: string, postId: number): Promise<boolean> {
  return deleteContentPost({ ...blogScope(workspaceId), postId });
}

export function listAdminBlogCategories(workspaceId: string) {
  return prisma.blogCategory.findMany({
    where: blogWhere(workspaceId),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
}

export function listAdminBlogTags(workspaceId: string) {
  return prisma.blogTag.findMany({
    where: blogWhere(workspaceId),
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export function listAdminBlogAuthors(workspaceId: string, options?: { activeOnly?: boolean }) {
  return prisma.blogAuthor.findMany({
    where: { ...blogWhere(workspaceId), ...(options?.activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
}

export function listAdminBlogMedia(workspaceId: string, options?: { q?: string; limit?: number }) {
  const q = options?.q?.trim();
  return prisma.blogMedia.findMany({
    where: {
      ...blogWhere(workspaceId),
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

/** La dirección pública del sitio de la institución, para el link "Ver publicado". */
export async function loadPublicSlug(workspaceId: string): Promise<string | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { publicSlug: true },
  });
  return branding?.publicSlug ?? null;
}
