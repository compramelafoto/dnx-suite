/**
 * Metadata y JSON-LD del blog Clickatón sobre los helpers de `@repo/content`.
 */
import type { Metadata } from "next";
import { buildArticleJsonLd, buildContentOpenGraph } from "@repo/content";
import { siteConfig } from "@/config/site";
import { resolveContentSearchIndexing } from "@/lib/content/search-indexing";
import {
  blogCategoryPath,
  blogHomePath,
  blogPostPath,
  blogTagPath,
  clickatonContentSite,
  getClickatonBlogOrigin,
  toAbsoluteBlogUrl,
} from "@/lib/content/content-site-config";

const DEFAULT_OG_IMAGE = siteConfig.brandAssets.ogImage;

const BLOG_HOME_TITLE = "Blog de Clickatón";
const BLOG_HOME_DESCRIPTION =
  "Notas, guías y novedades sobre maratones fotográficas: cómo participar, cómo mirar mejor y qué pasa en cada ciudad.";

function robotsFor(noIndex: boolean): Metadata["robots"] {
  const { allowIndexing } = resolveContentSearchIndexing();
  if (noIndex || !allowIndexing) {
    return { index: false, follow: false, nocache: true };
  }
  return { index: true, follow: true };
}

function buildMetadata(input: {
  title: string;
  description: string;
  path: string;
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  noIndex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = `${getClickatonBlogOrigin()}${input.path}`;
  const image =
    toAbsoluteBlogUrl(input.imageUrl) ?? toAbsoluteBlogUrl(DEFAULT_OG_IMAGE) ?? undefined;

  const openGraph = buildContentOpenGraph({
    siteName: clickatonContentSite.siteName,
    title: input.title,
    description: input.description,
    url,
    imageUrl: image,
    type: input.type ?? "website",
    locale: clickatonContentSite.locale,
  });

  // El layout root ya aplica `title.template = "%s — Clickatón"`.
  // Aquí solo el título de página; Twitter/OG llevan marca explícita una vez.
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.canonicalUrl?.trim() || url },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: `${input.title} — ${siteConfig.name}`,
      description: input.description,
      images: image ? [image] : [],
    },
    robots: robotsFor(Boolean(input.noIndex)),
  };
}

export function buildBlogHomeMetadata(): Metadata {
  return buildMetadata({
    title: BLOG_HOME_TITLE,
    description: BLOG_HOME_DESCRIPTION,
    path: blogHomePath(),
  });
}

export function buildBlogArticleMetadata(post: {
  title: string;
  slug: string;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
}): Metadata {
  return buildMetadata({
    title: post.seoTitle?.trim() || post.title,
    description:
      post.seoDescription?.trim() || post.excerpt?.trim() || BLOG_HOME_DESCRIPTION,
    path: blogPostPath(post.slug),
    canonicalUrl: post.canonicalUrl,
    imageUrl: post.ogImageUrl || post.heroImageUrl,
    noIndex: post.noIndex,
    type: "article",
  });
}

export function buildBlogCategoryMetadata(category: {
  name: string;
  slug: string;
  description: string | null;
}): Metadata {
  return buildMetadata({
    title: `${category.name} — Blog de Clickatón`,
    description:
      category.description?.trim() ||
      `Notas del blog de Clickatón sobre ${category.name.toLowerCase()}.`,
    path: blogCategoryPath(category.slug),
  });
}

export function buildBlogTagMetadata(tag: { name: string; slug: string }): Metadata {
  return buildMetadata({
    title: `${tag.name} — Blog de Clickatón`,
    description: `Notas del blog de Clickatón etiquetadas como ${tag.name}.`,
    path: blogTagPath(tag.slug),
  });
}

export function serializeBlogArticleJsonLd(post: {
  title: string;
  slug: string;
  excerpt: string | null;
  seoDescription: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  author: { name: string; slug: string } | null;
}): string {
  const origin = getClickatonBlogOrigin();
  const jsonLd = buildArticleJsonLd({
    title: post.title,
    description: post.seoDescription?.trim() || post.excerpt?.trim() || undefined,
    url: `${origin}${blogPostPath(post.slug)}`,
    imageUrl:
      toAbsoluteBlogUrl(post.ogImageUrl || post.heroImageUrl) ??
      toAbsoluteBlogUrl(DEFAULT_OG_IMAGE) ??
      undefined,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    authorName: post.author?.name,
    publisherName: clickatonContentSite.publisherName,
    publisherUrl: origin,
    publisherLogoUrl: toAbsoluteBlogUrl(clickatonContentSite.logoPath) ?? undefined,
    inLanguage: clickatonContentSite.language,
  });
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
