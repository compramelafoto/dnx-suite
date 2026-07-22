import type { Metadata } from "next";
import {
  JoinAllies,
  JoinEcosystem,
  JoinFaq,
  JoinFinalCta,
  JoinHero,
  JoinLevels,
  JoinPresence,
  JoinTimeline,
  JoinTouchpoints,
  JoinWhatIs,
  JoinWhy,
} from "@/components/formar-parte";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { formarParteContent } from "@/content/formar-parte";

const content = formarParteContent;
const path = routes.joinUs;
const pageUrl = new URL(path, siteConfig.url).toString();
const ogImage = content.hero.image.src;

export const metadata: Metadata = {
  title: {
    absolute: content.meta.title,
  },
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
        alt: content.hero.image.alt,
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

/** Landing institucional “Formá parte de Clickatón” (empresas e instituciones). */
export default function FormarPartePage() {
  return (
    <article>
      <JoinHero />
      <JoinWhatIs />
      <JoinWhy />
      <JoinTimeline />
      <JoinPresence />
      <JoinTouchpoints />
      <JoinAllies />
      <JoinLevels />
      <JoinEcosystem />
      <JoinFaq />
      <JoinFinalCta />
    </article>
  );
}
