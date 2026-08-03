import { buildArticleJsonLd } from "@repo/content";
import { resolveBlogPostShareImageUrl } from "@/lib/blog/blog-post-images";
import { getBlogCategoryUrl, getBlogHomeUrl, getBlogPostUrl } from "@/lib/blog/blog-site-url";

export type BlogArticleJsonLdInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  seoDescription?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  heroImageUrl?: string | null;
  ogImageUrl?: string | null;
  author?: {
    name: string;
    slug?: string;
    url?: string | null;
  } | null;
};

const PUBLISHER = {
  name: "ComprameLaFoto",
  url: "https://compramelafoto.com",
  logoUrl: "https://compramelafoto.com/watermark.png",
};

/** Genera el objeto JSON-LD Article (Schema.org) para un artículo del blog. */
export function buildBlogArticleJsonLd(input: BlogArticleJsonLdInput): Record<string, unknown> {
  const url = getBlogPostUrl(input.slug);
  const image = resolveBlogPostShareImageUrl({
    slug: input.slug,
    heroImageUrl: input.heroImageUrl,
    ogImageUrl: input.ogImageUrl,
    updatedAt: input.updatedAt,
  });

  const description =
    input.seoDescription?.trim() ||
    input.excerpt?.trim() ||
    undefined;

  return buildArticleJsonLd({
    title: input.title,
    description,
    url,
    imageUrl: image,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
    authorName: input.author?.name,
    authorUrl: input.author?.url ?? undefined,
    publisherName: PUBLISHER.name,
    publisherUrl: PUBLISHER.url,
    publisherLogoUrl: PUBLISHER.logoUrl,
    inLanguage: "es-AR",
  });
}

/** Serializa JSON-LD para insertar en `<script type="application/ld+json">`. */
export function serializeBlogArticleJsonLd(input: BlogArticleJsonLdInput): string {
  return JSON.stringify(buildBlogArticleJsonLd(input));
}

export type BlogFaqJsonLdItem = { q: string; a: string };

/** Genera FAQPage JSON-LD (Schema.org) a partir de preguntas frecuentes del artículo. */
export function buildBlogFaqPageJsonLd(
  faq: BlogFaqJsonLdItem[]
): Record<string, unknown> | null {
  if (!faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function serializeBlogFaqPageJsonLd(faq: BlogFaqJsonLdItem[]): string | null {
  const schema = buildBlogFaqPageJsonLd(faq);
  return schema ? JSON.stringify(schema) : null;
}

export type BlogBreadcrumbJsonLdInput = {
  title: string;
  slug: string;
  category?: {
    name: string;
    slug: string;
  } | null;
};

/** Genera BreadcrumbList JSON-LD para un artículo del blog. */
export function buildBlogBreadcrumbJsonLd(
  input: BlogBreadcrumbJsonLdInput
): Record<string, unknown> {
  const items: Record<string, unknown>[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Blog",
      item: getBlogHomeUrl(),
    },
  ];

  if (input.category) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: input.category.name,
      item: getBlogCategoryUrl(input.category.slug),
    });
    items.push({
      "@type": "ListItem",
      position: 3,
      name: input.title,
      item: getBlogPostUrl(input.slug),
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: input.title,
      item: getBlogPostUrl(input.slug),
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export function serializeBlogBreadcrumbJsonLd(input: BlogBreadcrumbJsonLdInput): string {
  return JSON.stringify(buildBlogBreadcrumbJsonLd(input));
}
