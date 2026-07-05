import { getPublicSiteOrigin } from "@/lib/public-site-url";

/** Origen canónico del sitio para URLs del blog. */
export function getBlogSiteUrl(): string {
  return getPublicSiteOrigin();
}

export function getBlogHomeUrl(): string {
  return `${getBlogSiteUrl()}/blog`;
}

export function getBlogPostUrl(slug: string): string {
  return `${getBlogSiteUrl()}/blog/${encodeURIComponent(slug)}`;
}

export function getBlogCategoryUrl(slug: string): string {
  return `${getBlogSiteUrl()}/blog/categoria/${encodeURIComponent(slug)}`;
}

export function getBlogTagUrl(slug: string): string {
  return `${getBlogSiteUrl()}/blog/tag/${encodeURIComponent(slug)}`;
}

/** Convierte una ruta o URL relativa en URL absoluta para OG / JSON-LD. */
export function toAbsoluteBlogAssetUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl?.trim()) return undefined;
  const value = pathOrUrl.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const origin = getBlogSiteUrl();
  return `${origin}${value.startsWith("/") ? "" : "/"}${value}`;
}
