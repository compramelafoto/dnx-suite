import type { Metadata } from "next";
import { Suspense } from "react";
import {
  HomeEditorialBanner,
  HomeFeaturedEvents,
  HomeHowItWorks,
  HomeInstitutionalBlock,
  HomeLatestCoverages,
  HomeLatestNews,
  HomeMostRead,
  HomeNearYouBlock,
  HomeOrganizerPitch,
  HomePhotographersCall,
  HomePlatformHero,
  HomeUpcomingEvents,
  HomeWhyPublish,
} from "@/components/home";
import { NewsletterOrFollowBlock } from "@/components/editorial/newsletter-follow-block";
import { EditorialContainer, Section } from "@/components/foundations";
import { composeHomeEditorial } from "@/lib/home-composition";
import { getHomeEditorialData } from "@/lib/articles";
import {
  getCachedHomepageCore,
  getNearbyEvents,
  getUpcomingEvents,
} from "@/lib/distribution";
import { parseGeoParams } from "@/lib/geo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Info Spot — Donde nacen los eventos",
  },
  description:
    "Info Spot conecta organizadores, fotógrafos y participantes. Publicá tu evento, conseguí cobertura y descubrí qué está pasando.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Info Spot — Donde nacen los eventos",
    description:
      "Info Spot conecta organizadores, fotógrafos y participantes. Publicá tu evento, conseguí cobertura y descubrí qué está pasando.",
    images: [
      {
        url: "/brand/og-default.png",
        width: 1200,
        height: 630,
        alt: "Info Spot",
      },
    ],
  },
};

type Props = {
  searchParams: Promise<{ lat?: string; lng?: string; radio?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const near = parseGeoParams(params);

  const [core, editorialData, nearby, upcomingFallback] = await Promise.all([
    getCachedHomepageCore(),
    getHomeEditorialData(),
    near
      ? getNearbyEvents({
          latitude: near.lat,
          longitude: near.lng,
          radiusKm: near.radiusKm,
          limit: 6,
        })
      : Promise.resolve([]),
    near ? Promise.resolve([]) : getUpcomingEvents({ limit: 6 }),
  ]);

  const home = composeHomeEditorial(editorialData);
  const banner = core.banner[0] ?? null;
  const nearEvents = nearby.length > 0 ? nearby : upcomingFallback;

  const showNewsBlocks =
    home.density !== "empty" &&
    (home.latest.length > 0 || home.secondary.length > 0 || Boolean(home.featured));
  const editorialPicks = [
    ...home.secondary,
    ...home.latest,
    ...(home.featured ? [home.featured] : []),
  ]
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .slice(0, home.density === "minimal" ? 3 : 5);

  return (
    <>
      {banner ? <HomeEditorialBanner item={banner} /> : <HomePlatformHero />}

      <Section spacing="xl">
        <EditorialContainer className="space-y-24 md:space-y-32">
          <HomeOrganizerPitch />
          <HomeHowItWorks />
          <HomeWhyPublish />
        </EditorialContainer>
      </Section>

      <Section tone="muted" spacing="xl">
        <EditorialContainer className="space-y-24">
          <HomeFeaturedEvents events={core.featured} />
          <HomeUpcomingEvents events={core.upcoming} />
        </EditorialContainer>
      </Section>

      <Section spacing="xl">
        <EditorialContainer>
          <HomePhotographersCall events={core.photographerCalls} />
        </EditorialContainer>
      </Section>

      <Section tone="muted" spacing="xl">
        <EditorialContainer>
          <Suspense fallback={null}>
            <HomeNearYouBlock events={nearEvents} hasUserLocation={Boolean(near)} />
          </Suspense>
        </EditorialContainer>
      </Section>

      {core.coverages.length > 0 || home.density !== "empty" ? (
        <Section spacing="xl">
          <EditorialContainer>
            <HomeLatestCoverages
              coverages={core.coverages}
              articles={
                core.coverages.length === 0
                  ? [
                      ...(home.featured ? [home.featured] : []),
                      ...home.secondary,
                      ...home.latest,
                    ]
                  : undefined
              }
            />
          </EditorialContainer>
        </Section>
      ) : null}

      {showNewsBlocks ? (
        <Section tone="muted" spacing="xl">
          <EditorialContainer className="space-y-24 md:space-y-28">
            {home.featured || home.latest.length > 0 ? (
              <HomeLatestNews
                articles={
                  home.density === "minimal"
                    ? ([home.featured, ...home.secondary].filter(Boolean) as NonNullable<
                        typeof home.featured
                      >[])
                    : home.latest.length > 0
                      ? home.latest
                      : ([home.featured, ...home.secondary].filter(Boolean) as NonNullable<
                          typeof home.featured
                        >[])
                }
              />
            ) : null}
            {editorialPicks.length > 0 && home.density !== "minimal" ? (
              <HomeMostRead articles={editorialPicks} />
            ) : null}
          </EditorialContainer>
        </Section>
      ) : null}

      <Section spacing="xl">
        <EditorialContainer className="space-y-20 md:space-y-24">
          <HomeInstitutionalBlock />
          <NewsletterOrFollowBlock />
        </EditorialContainer>
      </Section>
    </>
  );
}
