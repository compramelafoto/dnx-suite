import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import {
  getContentSitemapEntries,
  getPublishedPostBySlug,
  getPublishedPostsByCategorySlug,
  getPublishedPostsByTagSlug,
  incrementViewCount,
  listCategoriesForHome,
  listPublishedPosts,
  mapPublicPostTags,
  type PublicContentPostDetail,
  type PublicContentPostListItem,
} from "@repo/content";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { blogScope } from "./scope";

export type { PublicContentPostDetail, PublicContentPostListItem };
export { mapPublicPostTags };

/**
 * Lo que se lee del blog público de una institución (`/w/<slug>/blog`).
 *
 * El orden es el de carga, no el de la fecha: así ordenaba el blog de Alboom de donde vienen las
 * instituciones que migran, y lo que se publica después queda primero igual.
 */
const ORDEN = "createdAt" as const;

export type PublicBlog = {
  workspaceId: string;
  slug: string;
  nombre: string;
  logoUrl: string | null;
};

/** La institución dueña del blog, si tiene el sitio web habilitado. Una vez por pedido. */
export const loadPublicBlog = cache(async (publicSlug: string): Promise<PublicBlog | null> => {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug },
    select: {
      workspaceId: true,
      publicSlug: true,
      commercialName: true,
      logoUrl: true,
      workspace: { select: { name: true } },
    },
  });
  if (!branding) return null;
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, WEBSITE_MODULE_KEY))) return null;
  return {
    workspaceId: branding.workspaceId,
    slug: branding.publicSlug,
    nombre: branding.commercialName?.trim() || branding.workspace.name,
    logoUrl: branding.logoUrl,
  };
});

export function listBlogPosts(blog: PublicBlog, opts: { limit?: number; excludeId?: number } = {}) {
  return listPublishedPosts({ ...blogScope(blog.workspaceId), order: ORDEN, limit: opts.limit ?? 60, excludeId: opts.excludeId });
}

/** Artículos elegidos uno por uno (las placas del banner). Solo vuelven los publicados. */
export function listBlogPostsByIds(blog: PublicBlog, ids: number[]) {
  return listPublishedPosts({ ...blogScope(blog.workspaceId), order: ORDEN, limit: ids.length, ids });
}

export function getBlogPost(blog: PublicBlog, slug: string) {
  return getPublishedPostBySlug({ ...blogScope(blog.workspaceId), slug });
}

export function getBlogCategory(blog: PublicBlog, categorySlug: string) {
  return getPublishedPostsByCategorySlug({ ...blogScope(blog.workspaceId), order: ORDEN, categorySlug });
}

export function getBlogTag(blog: PublicBlog, tagSlug: string) {
  return getPublishedPostsByTagSlug({ ...blogScope(blog.workspaceId), order: ORDEN, tagSlug });
}

export function listBlogCategories(blog: PublicBlog) {
  return listCategoriesForHome(blogScope(blog.workspaceId));
}

export function getBlogSitemap(blog: PublicBlog) {
  return getContentSitemapEntries(blogScope(blog.workspaceId));
}

export function countBlogView(blog: PublicBlog, postId: number, visitorKey: string): void {
  incrementViewCount({ ...blogScope(blog.workspaceId), postId, visitorKey });
}

/** Dirección del blog y de un artículo, relativas al sitio. */
export const blogPath = (slug: string) => `/w/${slug}/blog`;
export const postPath = (slug: string, postSlug: string) => `/w/${slug}/blog/${postSlug}`;
