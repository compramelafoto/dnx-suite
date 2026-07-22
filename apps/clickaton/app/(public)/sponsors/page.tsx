import type { Metadata } from "next";
import {
  AlliesExpo,
  AlliesFinalCta,
  AlliesHero,
  AlliesImagine,
  AlliesMovement,
  AlliesVision,
  AlliesWays,
  AlliesWhyJoin,
} from "@/components/founding-allies";
import { foundingAlliesContent } from "@/content/founding-allies";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";

const content = foundingAlliesContent;
const path = routes.sponsors;
const pageUrl = new URL(path, siteConfig.url).toString();
const ogImage = "/images/founding-allies/hero.jpg";

export const metadata: Metadata = {
  title: content.meta.title,
  description: content.meta.description,
  alternates: {
    canonical: path,
  },
  openGraph: {
    title: `${content.meta.title} — ${siteConfig.name}`,
    description: content.meta.description,
    url: pageUrl,
    siteName: siteConfig.name,
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: ogImage,
        width: 1920,
        height: 1080,
        alt: "Aliados Fundadores — Clickatón",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${content.meta.title} — ${siteConfig.name}`,
    description: content.meta.description,
    images: [ogImage],
  },
  robots: {
    index: false,
    follow: false,
  },
};

/** Experiencia pública “Aliados Fundadores” (propuesta para empresas). */
export default function SponsorsPage() {
  return (
    <article>
      <AlliesHero />
      <AlliesMovement />
      <AlliesWhyJoin />
      <AlliesExpo />
      <AlliesImagine />
      <AlliesWays />
      <AlliesVision />
      <AlliesFinalCta />
    </article>
  );
}
