import type { Metadata } from "next";
import {
  OrganizerBenefits,
  OrganizerEconomics,
  OrganizerFaq,
  OrganizerFinalCta,
  OrganizerForm,
  OrganizerHero,
  OrganizerHow,
  OrganizerMap,
  OrganizerNeeds,
  OrganizerReceive,
  OrganizerWhatIs,
  OrganizerWho,
} from "@/components/organizar-sede";
import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { organizarSedeContent } from "@/content/organizar-sede";

const content = organizarSedeContent;
const path = routes.organize;
const pageUrl = new URL(path, siteConfig.url).toString();

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
  },
  twitter: {
    card: "summary_large_image",
    title: `${content.meta.title} — ${siteConfig.name}`,
    description: content.meta.description,
  },
  robots: {
    index: false,
    follow: false,
  },
};

/** Landing “Llevá Clickatón a tu ciudad” — reemplaza el stub anterior de /organizar. */
export default function OrganizePage() {
  return (
    <article>
      <OrganizerHero />
      <OrganizerWhatIs />
      <OrganizerBenefits />
      <OrganizerReceive />
      <OrganizerEconomics />
      <OrganizerWho />
      <OrganizerNeeds />
      <OrganizerMap />
      <OrganizerHow />
      <OrganizerFaq />
      <OrganizerForm />
      <OrganizerFinalCta />
    </article>
  );
}
