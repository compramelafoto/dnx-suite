import { getBlogDefaultCoverImagePath, getBlogDefaultCoverImageUrl } from "@/lib/blog/blog-default-cover";
import { getBlogSiteUrl, toAbsoluteBlogAssetUrl } from "@/lib/blog/blog-site-url";

export type BlogPostImageFields = {
  slug?: string | null;
  heroImageUrl?: string | null;
  ogImageUrl?: string | null;
};

export type BlogPostShareImageInput = BlogPostImageFields & {
  updatedAt?: Date | string | null;
};

function defaultBlogShareImageUrl(): string {
  return getBlogDefaultCoverImageUrl();
}

function shareImageCacheKey(updatedAt?: Date | string | null): string | undefined {
  if (!updatedAt) return undefined;
  const ts = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  return Number.isFinite(ts) && ts > 0 ? String(ts) : undefined;
}

/** URL pública en el mismo dominio del sitio (fallback para rutas relativas / dev). */
export function getBlogPostOgImageProxyUrl(
  slug: string,
  cacheKey?: string | number | null,
  siteUrl?: string
): string {
  const origin = (siteUrl?.trim() || getBlogSiteUrl()).replace(/\/$/, "");
  const base = `${origin}/api/blog/og-image/${encodeURIComponent(slug.trim())}`;
  if (cacheKey == null || cacheKey === "") return base;
  return `${base}?v=${encodeURIComponent(String(cacheKey))}`;
}

/**
 * Miniatura del artículo: hero del post o portada por defecto del blog.
 * Misma imagen que se muestra en el artículo y en tarjetas del listado.
 */
export function resolveBlogPostThumbnailUrl(post: BlogPostImageFields = {}): string {
  const hero = post.heroImageUrl?.trim() || null;
  const og = post.ogImageUrl?.trim() || null;
  return hero || og || getBlogDefaultCoverImagePath();
}

export type ResolveBlogPostShareImageOptions = {
  /** Override del origen del sitio (útil en tests; producción usa `getBlogSiteUrl`). */
  siteUrl?: string;
};

/**
 * URL absoluta para compartir en RRSS (og:image, twitter:image, JSON-LD).
 * El proxy sirve exactamente la misma imagen que `resolveBlogPostThumbnailUrl`.
 */
export function resolveBlogPostShareImageUrl(
  post: BlogPostShareImageInput = {},
  options?: ResolveBlogPostShareImageOptions
): string {
  const slug = post.slug?.trim();
  if (slug) {
    return getBlogPostOgImageProxyUrl(slug, shareImageCacheKey(post.updatedAt), options?.siteUrl);
  }

  const thumbnail = resolveBlogPostThumbnailUrl(post);
  return toAbsoluteBlogAssetUrl(thumbnail) ?? defaultBlogShareImageUrl();
}

/**
 * Al guardar un artículo: la imagen OG coincide con la miniatura (hero).
 */
export function syncBlogPostImageFields(input: BlogPostImageFields): {
  heroImageUrl: string | null;
  ogImageUrl: string | null;
} {
  const hero = input.heroImageUrl?.trim() || null;
  const og = input.ogImageUrl?.trim() || null;
  const thumbnail = hero || og;
  return {
    heroImageUrl: hero,
    ogImageUrl: thumbnail,
  };
}
