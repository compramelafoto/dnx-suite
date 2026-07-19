import type { Metadata } from "next";
import {
  AlliesExpo,
  AlliesFinalCta,
  AlliesHero,
  AlliesImagine,
  AlliesMerch,
  AlliesMovement,
  AlliesVision,
  AlliesWays,
  AlliesWhyJoin,
} from "@/components/founding-allies";
import { foundingAlliesContent } from "@/content/founding-allies";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";

const content = foundingAlliesContent;
const path = routes.foundingAllies;
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

export default function FoundingAlliesPage() {
  return (
    <article>
      <AlliesHero />
      <AlliesMovement />
      <AlliesWhyJoin />
      <AlliesExpo />
      <AlliesMerch />
      <AlliesImagine />
      <AlliesWays />
      <AlliesVision />
      <AlliesFinalCta />
    </article>
  );
}
