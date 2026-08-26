/**
 * Configuración del blog Clickatón para SEO / URLs absolutas.
 * Reutiliza los helpers existentes de origen público (no duplica lógica de env).
 */
import { siteConfig } from "@/config/site";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";

export const CLICKATON_BLOG_BASE_PATH = "/blog";

export const clickatonContentSite = {
  siteName: siteConfig.name,
  publisherName: siteConfig.name,
  locale: "es_AR",
  language: "es-AR",
  logoPath: siteConfig.brandAssets.ogDefaultBrand ?? siteConfig.brandAssets.ogImage,
} as const;

export function getClickatonBlogOrigin(): string {
  return resolveClickatonPublicOrigin().replace(/\/$/, "");
}

export function blogHomePath(): string {
  return CLICKATON_BLOG_BASE_PATH;
}

export function blogPostPath(slug: string): string {
  return `${CLICKATON_BLOG_BASE_PATH}/${encodeURIComponent(slug)}`;
}

export function blogCategoryPath(slug: string): string {
  return `${CLICKATON_BLOG_BASE_PATH}/categoria/${encodeURIComponent(slug)}`;
}

export function blogTagPath(slug: string): string {
  return `${CLICKATON_BLOG_BASE_PATH}/tag/${encodeURIComponent(slug)}`;
}

/** Convierte path relativo o URL absoluta en URL absoluta usable por crawlers. */
export function toAbsoluteBlogUrl(pathOrUrl: string | null | undefined): string | null {
  const value = pathOrUrl?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  const origin = getClickatonBlogOrigin();
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
}
