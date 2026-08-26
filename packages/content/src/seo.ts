export function buildContentCanonicalUrl(input: {
  baseUrl: string;
  path: string;
}): string {
  const base = input.baseUrl.replace(/\/+$/, "");
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  return `${base}${path}`;
}

export function buildContentOpenGraph(input: {
  siteName: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  type?: "website" | "article";
  locale?: string;
}): {
  title: string;
  description?: string;
  url: string;
  siteName: string;
  locale: string;
  type: "website" | "article";
  images: Array<{ url: string }>;
} {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    siteName: input.siteName,
    locale: input.locale ?? "es_AR",
    type: input.type ?? "website",
    images: input.imageUrl ? [{ url: input.imageUrl }] : [],
  };
}

export type BuildArticleJsonLdInput = {
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  authorName?: string;
  authorUrl?: string;
  publisherName: string;
  publisherUrl: string;
  publisherLogoUrl?: string;
  inLanguage?: string;
};

function toIsoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildArticleJsonLd(input: BuildArticleJsonLdInput): Record<string, unknown> {
  const author = input.authorName
    ? {
        "@type": "Person" as const,
        name: input.authorName,
        ...(input.authorUrl ? { url: input.authorUrl } : {}),
      }
    : {
        "@type": "Organization" as const,
        name: input.publisherName,
      };

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    url: input.url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    datePublished: toIsoDate(input.publishedAt),
    dateModified: toIsoDate(input.updatedAt ?? input.publishedAt),
    author,
    publisher: {
      "@type": "Organization",
      name: input.publisherName,
      url: input.publisherUrl,
      ...(input.publisherLogoUrl
        ? {
            logo: {
              "@type": "ImageObject",
              url: input.publisherLogoUrl,
            },
          }
        : {}),
    },
    inLanguage: input.inLanguage ?? "es-AR",
  };
}
