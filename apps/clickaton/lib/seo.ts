import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import type { AppRoute } from "@/config/navigation";
import { EDITION_COVER_HORIZONTAL } from "@/lib/admin/editions/cover-specs";

type PageMetaInput = {
  title: string;
  description: string;
  path: AppRoute | string;
  noIndex?: boolean;
  /**
   * Imagen para Open Graph / WhatsApp / Twitter.
   * Preferir portada horizontal de la maratón (absoluta o path del sitio).
   */
  image?: string | null;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
};

const DEFAULT_OG = {
  url: "/og-default.png",
  width: 1200,
  height: 630,
  alt: siteConfig.nameFull,
} as const;

/** Convierte path relativo o URL absoluta en URL absoluta usable por crawlers. */
export function toAbsolutePublicUrl(image?: string | null): string | null {
  if (!image) return null;
  const trimmed = image.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, siteConfig.url).toString();
  } catch {
    return null;
  }
}

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
}: PageMetaInput): Metadata {
  const url = new URL(path, siteConfig.url).toString();
  const absoluteImage = toAbsolutePublicUrl(image) ?? DEFAULT_OG.url;
  const hasCustomImage = Boolean(toAbsolutePublicUrl(image));
  const ogImage = {
    url: absoluteImage,
    width: hasCustomImage
      ? (imageWidth ?? EDITION_COVER_HORIZONTAL.width)
      : DEFAULT_OG.width,
    height: hasCustomImage
      ? (imageHeight ?? EDITION_COVER_HORIZONTAL.height)
      : DEFAULT_OG.height,
    alt: imageAlt?.trim() || (hasCustomImage ? title : DEFAULT_OG.alt),
  };

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${title} — ${siteConfig.name}`,
      description,
      url,
      siteName: siteConfig.name,
      locale: "es_AR",
      type: "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${siteConfig.name}`,
      description,
      images: [absoluteImage],
    },
    robots: (() => {
      const allowProdIndex =
        process.env.VERCEL_ENV === "production" &&
        process.env.CLICKATON_ALLOW_SEARCH_INDEXING === "true";
      if (noIndex || !allowProdIndex) {
        return { index: false, follow: false, nocache: true };
      }
      return { index: true, follow: true };
    })(),
  };
}
