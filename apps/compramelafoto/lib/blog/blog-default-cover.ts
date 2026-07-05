import { getBlogSiteUrl } from "@/lib/blog/blog-site-url";

/** Portada por defecto del blog cuando el artículo no tiene imagen destacada. */
export const BLOG_DEFAULT_COVER_IMAGE_PATH = "/images/blog/blog-og-cover.jpg";

export const BLOG_DEFAULT_COVER_IMAGE_ALT = "Blog de ComprameLaFoto";

export function getBlogDefaultCoverImagePath(): string {
  return BLOG_DEFAULT_COVER_IMAGE_PATH;
}

export function getBlogDefaultCoverImageUrl(): string {
  return `${getBlogSiteUrl()}${BLOG_DEFAULT_COVER_IMAGE_PATH}`;
}
