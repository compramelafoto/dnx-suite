import type { Metadata } from "next";
import {
  HomeFeaturedEvents,
  HomeHowItWorks,
  HomeInstitutionalBlock,
  HomeLatestCoverages,
  HomeLatestNews,
  HomeMostRead,
  HomeOrganizerPitch,
  HomePhotographersCall,
  HomePlatformHero,
  HomeWeekendAgenda,
  HomeWhyPublish,
} from "@/components/home";
import { NewsletterOrFollowBlock } from "@/components/editorial/newsletter-follow-block";
import { EditorialContainer, Section } from "@/components/foundations";
import { composeHomeEditorial } from "@/lib/home-composition";
import { getHomeEditorialData } from "@/lib/articles";
import { getFeaturedPublishedEvents } from "@/lib/events";

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

export default async function HomePage() {
  const [data, featuredEvents] = await Promise.all([
    getHomeEditorialData(),
    getFeaturedPublishedEvents(4),
  ]);
  const home = composeHomeEditorial(data);

  const coverageArticles = [
    ...(home.featured ? [home.featured] : []),
    ...home.secondary,
    ...home.latest,
  ].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

  const showNewsBlocks =
    home.density !== "empty" &&
    (home.latest.length > 0 || home.secondary.length > 0 || Boolean(home.featured));
  const showCoverages = home.density !== "empty";
  const showWeekend = home.density === "full";
  const editorialPicks = [...home.secondary, ...home.latest, ...(home.featured ? [home.featured] : [])]
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .slice(0, home.density === "minimal" ? 3 : 5);

  return (
    <>
      {/* 1. Hero — descubrimiento */}
      <HomePlatformHero />

      {/* 2. Organizadores — protagonista */}
      <Section spacing="xl">
        <EditorialContainer className="space-y-24 md:space-y-32">
          <HomeOrganizerPitch />
          <HomeHowItWorks />
          <HomeWhyPublish />
        </EditorialContainer>
      </Section>

      {/* 3. Eventos REAL próximos */}
      <Section tone="muted" spacing="xl">
        <EditorialContainer>
          <HomeFeaturedEvents events={featuredEvents} />
        </EditorialContainer>
      </Section>

      {/* 4. Fotógrafos — consecuencia */}
      <Section spacing="xl">
        <EditorialContainer>
          <HomePhotographersCall />
        </EditorialContainer>
      </Section>

      {/* 5. Coberturas — solo si hay notas REAL */}
      {showCoverages ? (
        <Section tone="muted" spacing="xl">
          <EditorialContainer>
            <HomeLatestCoverages articles={coverageArticles} />
          </EditorialContainer>
        </Section>
      ) : null}

      {/* 6. Noticias / lectura — densidad adaptativa */}
      {showNewsBlocks ? (
        <Section spacing="xl">
          <EditorialContainer className="space-y-24 md:space-y-28">
            {home.featured || home.latest.length > 0 ? (
              <HomeLatestNews
                articles={
                  home.density === "minimal"
                    ? [home.featured, ...home.secondary].filter(Boolean) as NonNullable<
                        typeof home.featured
                      >[]
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

      {/* 7. Agenda — solo portada completa */}
      {showWeekend ? (
        <Section tone="muted" spacing="xl">
          <EditorialContainer>
            <HomeWeekendAgenda />
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
