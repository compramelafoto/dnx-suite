/**
 * Lecturas públicas del blog Clickatón. Solo posts `PUBLISHED` de la plataforma.
 */
import {
  getAllPublishedPostsForHome,
  getContentSitemapEntries,
  getFeaturedPublishedPost,
  getPublishedPostBySlug,
  getPublishedPostsByCategorySlug,
  getPublishedPostsByTagSlug,
  incrementViewCount,
  listCategoriesForHome,
  listPublishedPosts,
  mapPublicPostTags,
  type PublicContentPostDetail,
  type PublicContentPostListItem,
  type PublicContentPostSearchItem,
} from "@repo/content";
import { prisma } from "@/lib/admin/db";

export type {
  PublicContentPostDetail,
  PublicContentPostListItem,
  PublicContentPostSearchItem,
};
export { mapPublicPostTags };

const PLATFORM = "clickaton" as const;

export async function listClickatonPublishedPosts(options?: {
  limit?: number;
  excludeId?: number;
}) {
  return listPublishedPosts({ prisma, platform: PLATFORM, ...options });
}

export async function getClickatonFeaturedPost() {
  return getFeaturedPublishedPost({ prisma, platform: PLATFORM });
}

export async function getAllClickatonPublishedPosts() {
  return getAllPublishedPostsForHome({ prisma, platform: PLATFORM });
}

export async function getClickatonPostBySlug(slug: string) {
  return getPublishedPostBySlug({ prisma, platform: PLATFORM, slug });
}

export async function getClickatonPostsByCategorySlug(categorySlug: string) {
  return getPublishedPostsByCategorySlug({ prisma, platform: PLATFORM, categorySlug });
}

export async function getClickatonPostsByTagSlug(tagSlug: string) {
  return getPublishedPostsByTagSlug({ prisma, platform: PLATFORM, tagSlug });
}

export async function listClickatonBlogCategories() {
  return listCategoriesForHome({ prisma, platform: PLATFORM });
}

export async function getClickatonBlogSitemapEntries() {
  return getContentSitemapEntries({ prisma, platform: PLATFORM });
}

/** Incremento de vistas único por visitante (fire-and-forget). */
export function incrementClickatonPostViews(postId: number, visitorKey: string): void {
  incrementViewCount({ prisma, platform: PLATFORM, postId, visitorKey });
}
