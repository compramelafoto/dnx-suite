import type { Metadata } from "next";
import { buildArticleJsonLd, buildContentOpenGraph } from "@repo/content";
import { appUrl } from "@/lib/app-url";
import { absoluteUrl } from "./public-format";
import { blogPath, postPath, type PublicBlog, type PublicContentPostDetail } from "./public";

/**
 * Metadata y JSON-LD del blog público de una institución. Molde: `apps/clickaton/lib/content/
 * blog-metadata.ts`, con una diferencia de fondo: acá el que publica es la INSTITUCIÓN, no
 * FOTOFFICE. El nombre del sitio, el editor del JSON-LD y la imagen de respaldo son los suyos —
 * para Google ese blog es de la Sociedad de Fotógrafos, no de la plataforma que lo aloja.
 *
 * Las direcciones van absolutas (`appUrl()`): una canonical o una imagen de OpenGraph relativas
 * no le sirven a nadie que lea la página desde afuera.
 */

export function blogAbsoluteUrl(path: string): string {
  return absoluteUrl(appUrl(), path) ?? path;
}

export function blogRssPath(slug: string): string {
  return `${blogPath(slug)}/rss.xml`;
}

export function blogDefaultDescription(blog: PublicBlog): string {
  return `Artículos, novedades y notas de ${blog.nombre}.`;
}

export function buildBlogMetadata(
  blog: PublicBlog,
  input: {
    title: string;
    description: string;
    path: string;
    canonicalUrl?: string | null;
    imageUrl?: string | null;
    noIndex?: boolean;
    type?: "website" | "article";
    publishedAt?: Date | null;
    updatedAt?: Date | null;
    /** Sólo en el listado: el `<link rel="alternate">` del RSS. */
    withRss?: boolean;
  },
): Metadata {
  const url = blogAbsoluteUrl(input.path);
  const image = absoluteUrl(appUrl(), input.imageUrl) ?? absoluteUrl(appUrl(), blog.logoUrl) ?? undefined;
  // No hay `title.template` en el layout raíz: el nombre de la institución va acá, una vez.
  const fullTitle = `${input.title} | ${blog.nombre}`;

  const openGraph = buildContentOpenGraph({
    siteName: blog.nombre,
    title: input.title,
    description: input.description,
    url,
    imageUrl: image,
    type: input.type ?? "website",
  });

  return {
    title: fullTitle,
    description: input.description,
    alternates: {
      canonical: input.canonicalUrl?.trim() || url,
      ...(input.withRss ? { types: { "application/rss+xml": blogAbsoluteUrl(blogRssPath(blog.slug)) } } : {}),
    },
    openGraph:
      openGraph.type === "article"
        ? {
            ...openGraph,
            type: "article",
            publishedTime: input.publishedAt?.toISOString(),
            modifiedTime: (input.updatedAt ?? input.publishedAt)?.toISOString(),
          }
        : openGraph,
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description: input.description,
      images: image ? [image] : [],
    },
    robots: input.noIndex ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
  };
}

export function buildBlogPostMetadata(blog: PublicBlog, post: PublicContentPostDetail): Metadata {
  return buildBlogMetadata(blog, {
    title: post.seoTitle?.trim() || post.title,
    description: post.seoDescription?.trim() || post.excerpt?.trim() || blogDefaultDescription(blog),
    path: postPath(blog.slug, post.slug),
    canonicalUrl: post.canonicalUrl,
    imageUrl: post.ogImageUrl || post.heroImageUrl,
    noIndex: post.noIndex,
    type: "article",
    publishedAt: post.publishedAt,
    updatedAt: post.lastReviewedAt ?? post.updatedAt,
  });
}

/**
 * El JSON-LD del artículo, listo para un `<script type="application/ld+json">`. `BlogPosting`
 * (que es un `Article`) en vez del `Article` genérico del motor: es lo que es, y Google lo
 * entiende mejor. El `<` se escapa para que un título con `</script>` no corte el script.
 */
export function serializeBlogPostJsonLd(blog: PublicBlog, post: PublicContentPostDetail): string {
  const jsonLd = buildArticleJsonLd({
    title: post.title,
    description: post.seoDescription?.trim() || post.excerpt?.trim() || undefined,
    url: blogAbsoluteUrl(postPath(blog.slug, post.slug)),
    imageUrl: absoluteUrl(appUrl(), post.ogImageUrl || post.heroImageUrl) ?? undefined,
    publishedAt: post.publishedAt,
    updatedAt: post.lastReviewedAt ?? post.updatedAt,
    authorName: post.author?.name,
    publisherName: blog.nombre,
    publisherUrl: blogAbsoluteUrl(`/w/${blog.slug}`),
    publisherLogoUrl: absoluteUrl(appUrl(), blog.logoUrl) ?? undefined,
  });
  return JSON.stringify({ ...jsonLd, "@type": "BlogPosting" }).replace(/</g, "\\u003c");
}
