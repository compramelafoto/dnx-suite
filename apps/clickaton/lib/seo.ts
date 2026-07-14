import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import type { AppRoute } from "@/config/navigation";

type PageMetaInput = {
  title: string;
  description: string;
  path: AppRoute | string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = new URL(path, siteConfig.url).toString();

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
      images: [
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          alt: siteConfig.nameFull,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${siteConfig.name}`,
      description,
      images: ["/og-default.png"],
    },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: false, follow: false },
  };
}
