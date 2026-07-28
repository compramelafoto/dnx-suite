import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { MarathonDetailView } from "@/components/marathon/MarathonDetailView";
import { routes } from "@/config/navigation";
import {
  getPublicMarathonBySlug,
  getPublicMarathonCapabilities,
  getPublicMarathonVisibility,
  listRoutableMarathonSlugs,
} from "@/data/public-marathons";
import { getPublicRegistrationOfferAction } from "@/lib/public-registration/actions/public-registration";
import { buildPageMetadata } from "@/lib/seo";
import { getPublicTimelineBySlug } from "@/lib/timeline/public-api";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Alineado a Cache-Control de FotoRank Public API V1. */
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await listRoutableMarathonSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const marathon = await getPublicMarathonBySlug(slug);
  if (!marathon) {
    return buildPageMetadata({
      title: "Maratón no encontrada",
      description: "La edición solicitada no está disponible.",
      path: `/maratones/${slug}`,
      noIndex: true,
    });
  }

  const visibility = getPublicMarathonVisibility(marathon);

  return buildPageMetadata({
    title: visibility.isDemo
      ? `${marathon.name} — ficha técnica`
      : `${marathon.name} — ${marathon.city || "Clickaton"}`,
    description: marathon.shortDescription,
    path: `/maratones/${marathon.slug}`,
    // Prelanzamiento: forzar noindex. Cuando se active indexación, usar !visibility.indexable.
    noIndex: true,
  });
}

export default async function MarathonDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const marathon = await getPublicMarathonBySlug(slug);
  if (!marathon) notFound();

  const visibility = getPublicMarathonVisibility(marathon);
  const [capabilities, offerResult, timeline] = await Promise.all([
    getPublicMarathonCapabilities(marathon.id),
    getPublicRegistrationOfferAction(slug),
    getPublicTimelineBySlug(slug),
  ]);
  const offer = offerResult.ok ? offerResult.data : null;

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Maratones", href: routes.marathons },
          { label: visibility.isDemo ? "Demo técnica" : marathon.name },
        ]}
      />
      <MarathonDetailView
        marathon={marathon}
        capabilities={capabilities}
        nativeRegistrationHref={offer?.available ? offer.href : null}
        nativeRegistrationLabel={offer?.available ? offer.label : null}
        timelineMilestones={timeline?.milestones ?? null}
        timelineServerNow={timeline?.serverNow ?? null}
      />
    </>
  );
}
