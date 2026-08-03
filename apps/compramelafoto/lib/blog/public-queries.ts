import {
  getAllPublishedPostsForHome,
  getFeaturedPublishedPost as getFeaturedPublishedPostCore,
  getLatestPublishedPosts as getLatestPublishedPostsCore,
  getPublishedPostBySlug as getPublishedPostBySlugCore,
  getPublishedPostsByCategorySlug as getPublishedPostsByCategorySlugCore,
  getPublishedPostsByTagSlug as getPublishedPostsByTagSlugCore,
  listCategoriesForHome,
  mapPublicPostTags,
  publicPostDetailSelect,
  publicPostListSelect,
  type PublicBlogPostDetail,
  type PublicBlogPostListItem,
  type PublicBlogPostSearchItem,
} from "@repo/content";
import { CLF_CONTENT_PLATFORM } from "@/lib/blog/content-platform";
import { prisma } from "@/lib/prisma";

export {
  publicPostListSelect,
  publicPostDetailSelect,
  mapPublicPostTags,
  type PublicBlogPostListItem,
  type PublicBlogPostSearchItem,
  type PublicBlogPostDetail,
};

export async function getFeaturedPublishedPost(): Promise<PublicBlogPostListItem | null> {
  return getFeaturedPublishedPostCore({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
  });
}

export async function getLatestPublishedPosts(
  limit = 9,
  excludeId?: number
): Promise<PublicBlogPostListItem[]> {
  return getLatestPublishedPostsCore({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    limit,
    excludeId,
  });
}

/** Todos los publicados para búsqueda rápida en la home del blog. */
export async function getAllPublishedPostsForBlogHome(): Promise<PublicBlogPostSearchItem[]> {
  return getAllPublishedPostsForHome({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
  });
}

export async function getPublishedPostsByCategorySlug(
  categorySlug: string,
  limit = 50
): Promise<{
  category: { id: number; name: string; slug: string; description: string | null };
  posts: PublicBlogPostListItem[];
} | null> {
  return getPublishedPostsByCategorySlugCore({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    categorySlug,
    limit,
  });
}

export async function getPublishedPostsByTagSlug(
  tagSlug: string,
  limit = 50
): Promise<{
  tag: { id: number; name: string; slug: string };
  posts: PublicBlogPostListItem[];
} | null> {
  return getPublishedPostsByTagSlugCore({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    tagSlug,
    limit,
  });
}

export async function getPublishedPostBySlug(slug: string): Promise<PublicBlogPostDetail | null> {
  return getPublishedPostBySlugCore({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
    slug,
  });
}

export async function getBlogCategoriesForHome() {
  return listCategoriesForHome({
    prisma,
    platform: CLF_CONTENT_PLATFORM,
  });
}
