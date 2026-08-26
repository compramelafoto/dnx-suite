import type { Metadata } from "next";
import { buildContentCanonicalUrl, buildContentOpenGraph } from "@repo/content";
import { getBlogDefaultCoverImageUrl } from "@/lib/blog/blog-default-cover";
import { resolveBlogPostShareImageUrl } from "@/lib/blog/blog-post-images";
import {
  getBlogCategoryUrl,
  getBlogHomeUrl,
  getBlogSiteUrl,
  getBlogTagUrl,
} from "@/lib/blog/blog-site-url";

const SITE_NAME = "ComprameLaFoto";

function defaultOgImage() {
  return getBlogDefaultCoverImageUrl();
}

/** Dimensiones recomendadas para tarjetas OG (1.91:1). */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

function toIsoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildBlogHomeMetadata(): Metadata {
  const title = `Blog | ${SITE_NAME}`;
  const description =
    "Artículos sobre fotografía escolar, deportiva, negocio fotográfico y novedades de ComprameLaFoto.";
  const url = getBlogHomeUrl();
  const image = defaultOgImage();
  const og = buildContentOpenGraph({
    siteName: SITE_NAME,
    title,
    description,
    url,
    imageUrl: image,
    type: "website",
  });

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...og,
      images: [{ url: image, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: SITE_NAME }],
    },
  };
}

type ArticleMetadataInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  heroImageUrl?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  lastReviewedAt?: Date | string | null;
};

export function buildBlogArticleMetadata(post: ArticleMetadataInput): Metadata {
  const seoHeadline = post.seoTitle?.trim() || post.title;
  const title = `${seoHeadline} | ${SITE_NAME}`;
  const description = post.seoDescription?.trim() || post.excerpt?.trim() || undefined;
  const canonical =
    post.canonicalUrl?.trim() ||
    buildContentCanonicalUrl({
      baseUrl: getBlogSiteUrl(),
      path: `/blog/${encodeURIComponent(post.slug)}`,
    });
  const image = resolveBlogPostShareImageUrl({
    slug: post.slug,
    heroImageUrl: post.heroImageUrl,
    ogImageUrl: post.ogImageUrl,
    updatedAt: post.updatedAt ?? post.lastReviewedAt ?? post.publishedAt,
  });
  const hasHero = Boolean(post.heroImageUrl?.trim() || post.ogImageUrl?.trim());
  const publishedTime = toIsoDate(post.publishedAt);
  const modifiedTime = toIsoDate(post.lastReviewedAt || post.updatedAt || post.publishedAt);
  const socialTitle = post.title;

  const ogImage = {
    url: image,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: socialTitle,
    ...(hasHero ? { secureUrl: image } : {}),
  };

  return {
    title,
    description,
    alternates: { canonical },
    robots: post.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "article",
      images: [ogImage],
      publishedTime,
      modifiedTime,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: image, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: socialTitle }],
    },
  };
}

export function buildBlogCategoryMetadata(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Metadata {
  const title = `${input.name} | Blog ${SITE_NAME}`;
  const description = input.description?.trim() || `Artículos sobre ${input.name} en el blog de ${SITE_NAME}.`;
  const url = getBlogCategoryUrl(input.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "website",
      images: [{ url: defaultOgImage(), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function buildBlogTagMetadata(input: { name: string; slug: string }): Metadata {
  const title = `#${input.name} | Blog ${SITE_NAME}`;
  const description = `Artículos etiquetados con ${input.name} en el blog de ${SITE_NAME}.`;
  const url = getBlogTagUrl(input.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_AR",
      type: "website",
      images: [{ url: defaultOgImage(), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function getDefaultSitemapOrigin(): string {
  return getBlogSiteUrl();
}
