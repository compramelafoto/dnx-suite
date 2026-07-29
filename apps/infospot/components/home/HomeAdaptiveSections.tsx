import { Suspense, type ReactNode } from "react";
import {
  HomeCategoryBlocks,
  HomeFeaturedEvents,
  HomeHeroSlider,
  HomeHowItWorks,
  HomeInstitutionalBlock,
  HomeLatestCoverages,
  HomeLatestNews,
  HomeMostRead,
  HomeNearYouBlock,
  HomeNovedadesFeed,
  HomeOrganizerPitch,
  HomePhotographersCall,
  HomePlatformHero,
  HomeUpcomingEvents,
  HomeWhyPublish,
} from "@/components/home";
import type { DistributionBannerItem } from "@/lib/distribution";
import { HomeExperienceSwitcher } from "@/components/home/HomeExperienceSwitcher";
import { HomeNearbyFeedStrip } from "@/components/home/HomeNearbyFeedStrip";
import { NewsletterOrFollowBlock } from "@/components/editorial/newsletter-follow-block";
import { EditorialContainer, Section } from "@/components/foundations";
import type { HomeComposition } from "@/lib/home-composition";
import type { HomeBlockId, HomeExperience } from "@/lib/home-experience";
import type { PublicProfileType } from "@/lib/dnx-user-profiles";
import type { InfoSpotFeedItem, InfoSpotFeedItemDto } from "@/lib/feed/client";

type EventList = Parameters<typeof HomeFeaturedEvents>[0]["events"];
type CallList = Parameters<typeof HomePhotographersCall>[0]["events"];
type CoverageList = Parameters<typeof HomeLatestCoverages>[0]["coverages"];
type NearList = Parameters<typeof HomeNearYouBlock>[0]["events"];

type Props = {
  experience: HomeExperience;
  /** Slides del HERO (0 = platform hero; 1+ = slider). */
  banners: DistributionBannerItem[];
  home: HomeComposition;
  featured: EventList;
  upcoming: EventList;
  photographerCalls: CallList;
  coverages: CoverageList;
  nearEvents: NearList;
  hasUserLocation: boolean;
  feedItems: InfoSpotFeedItemDto[];
  feedNextCursor: string | null;
  feedHasMore: boolean;
  feedExcludeContentKeys: string[];
  /** Bloques Etapa 15 (solo con GPS/manual en URL). */
  nearbyUpcoming?: InfoSpotFeedItem[];
  nearbyCalls?: InfoSpotFeedItem[];
};

function mutedSection(children: ReactNode, key: string) {
  return (
    <Section key={key} tone="muted" spacing="xl">
      <EditorialContainer className="space-y-24">{children}</EditorialContainer>
    </Section>
  );
}

function plainSection(children: ReactNode, key: string) {
  return (
    <Section key={key} spacing="xl">
      <EditorialContainer className="space-y-24">{children}</EditorialContainer>
    </Section>
  );
}

/**
 * Renderiza la Home según el orden de bloques del resolver.
 */
export function HomeAdaptiveSections({
  experience,
  banners,
  home,
  featured,
  upcoming,
  photographerCalls,
  coverages,
  nearEvents,
  hasUserLocation,
  feedItems,
  feedNextCursor,
  feedHasMore,
  feedExcludeContentKeys,
  nearbyUpcoming = [],
  nearbyCalls = [],
}: Props) {
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

  const switcher =
    experience.canSwitchMode && experience.mode !== "GUEST" ? (
      <Section key="mode-switcher" spacing="md">
        <EditorialContainer>
          <HomeExperienceSwitcher
            availableModes={experience.availableModes}
            activeMode={experience.mode as PublicProfileType}
          />
        </EditorialContainer>
      </Section>
    ) : null;

  const nodes: ReactNode[] = [];
  if (switcher) nodes.push(switcher);

  let mutedToggle = false;

  for (const block of experience.blocks) {
    const section = renderBlock(block, {
      banners,
      home,
      featured,
      upcoming,
      photographerCalls,
      coverages,
      nearEvents,
      hasUserLocation,
      showNewsBlocks,
      editorialPicks,
      muted: mutedToggle,
      feedItems,
      feedNextCursor,
      feedHasMore,
      feedExcludeContentKeys,
      nearbyUpcoming,
      nearbyCalls,
    });
    if (!section) continue;
    nodes.push(section);
    if (block !== "hero") mutedToggle = !mutedToggle;
  }

  return <>{nodes}</>;
}

function renderBlock(
  block: HomeBlockId,
  ctx: {
    banners: DistributionBannerItem[];
    home: HomeComposition;
    featured: EventList;
    upcoming: EventList;
    photographerCalls: CallList;
    coverages: CoverageList;
    nearEvents: NearList;
    hasUserLocation: boolean;
    showNewsBlocks: boolean;
    editorialPicks: NonNullable<HomeComposition["featured"]>[];
    muted: boolean;
    feedItems: InfoSpotFeedItemDto[];
    feedNextCursor: string | null;
    feedHasMore: boolean;
    feedExcludeContentKeys: string[];
    nearbyUpcoming: InfoSpotFeedItem[];
    nearbyCalls: InfoSpotFeedItem[];
  },
): ReactNode {
  switch (block) {
    case "hero":
      return ctx.banners.length > 0 ? (
        <HomeHeroSlider key="hero" items={ctx.banners} />
      ) : (
        <HomePlatformHero key="hero" />
      );

    case "organizer_pitch":
      return ctx.muted
        ? mutedSection(<HomeOrganizerPitch />, "organizer_pitch")
        : plainSection(<HomeOrganizerPitch />, "organizer_pitch");

    case "how_it_works":
      return ctx.muted
        ? mutedSection(<HomeHowItWorks />, "how_it_works")
        : plainSection(<HomeHowItWorks />, "how_it_works");

    case "why_publish":
      return ctx.muted
        ? mutedSection(<HomeWhyPublish />, "why_publish")
        : plainSection(<HomeWhyPublish />, "why_publish");

    case "featured_events":
      return ctx.muted
        ? mutedSection(<HomeFeaturedEvents events={ctx.featured} />, "featured_events")
        : plainSection(<HomeFeaturedEvents events={ctx.featured} />, "featured_events");

    case "unified_feed": {
      const body = (
        <HomeNovedadesFeed
          initialItems={ctx.feedItems}
          initialNextCursor={ctx.feedNextCursor}
          initialHasMore={ctx.feedHasMore}
          excludeContentKeys={ctx.feedExcludeContentKeys}
        />
      );
      return ctx.muted
        ? mutedSection(body, "unified_feed")
        : plainSection(body, "unified_feed");
    }

    case "upcoming_events":
      return ctx.muted
        ? mutedSection(<HomeUpcomingEvents events={ctx.upcoming} />, "upcoming_events")
        : plainSection(<HomeUpcomingEvents events={ctx.upcoming} />, "upcoming_events");

    case "photographer_calls":
      return ctx.muted
        ? mutedSection(
            <HomePhotographersCall events={ctx.photographerCalls} />,
            "photographer_calls",
          )
        : plainSection(
            <HomePhotographersCall events={ctx.photographerCalls} />,
            "photographer_calls",
          );

    case "near_you": {
      const body = (
        <div className="space-y-16 md:space-y-20">
          <Suspense fallback={null}>
            <HomeNearYouBlock
              events={ctx.nearEvents}
              hasUserLocation={ctx.hasUserLocation}
            />
          </Suspense>
          {ctx.hasUserLocation ? (
            <>
              <HomeNearbyFeedStrip
                id="proximas-cercanas"
                eyebrow="Agenda"
                title="Próximas actividades cercanas"
                description="Ordenadas por fecha y distancia."
                items={ctx.nearbyUpcoming}
              />
              <HomeNearbyFeedStrip
                id="convocatorias-cercanas"
                eyebrow="Fotógrafos"
                title="Convocatorias cercanas"
                description="Solo convocatorias abiertas cerca tuyo."
                items={ctx.nearbyCalls}
              />
            </>
          ) : null}
        </div>
      );
      return ctx.muted
        ? mutedSection(body, "near_you")
        : plainSection(body, "near_you");
    }

    case "coverages": {
      const coverageList = ctx.coverages ?? [];
      if (coverageList.length === 0 && ctx.home.density === "empty") return null;
      const body = (
        <HomeLatestCoverages
          coverages={coverageList}
          articles={
            coverageList.length === 0
              ? [
                  ...(ctx.home.featured ? [ctx.home.featured] : []),
                  ...ctx.home.secondary,
                  ...ctx.home.latest,
                ]
              : undefined
          }
        />
      );
      return ctx.muted ? mutedSection(body, "coverages") : plainSection(body, "coverages");
    }

    case "category_favorites": {
      if (ctx.home.categoryBlocks.length === 0) return null;
      const body = <HomeCategoryBlocks blocks={ctx.home.categoryBlocks} />;
      return ctx.muted
        ? mutedSection(body, "category_favorites")
        : plainSection(body, "category_favorites");
    }

    case "news": {
      if (!ctx.showNewsBlocks) return null;
      const body = (
        <div className="space-y-24 md:space-y-28">
          {ctx.home.featured || ctx.home.latest.length > 0 ? (
            <HomeLatestNews
              articles={
                ctx.home.density === "minimal"
                  ? ([ctx.home.featured, ...ctx.home.secondary].filter(
                      Boolean,
                    ) as NonNullable<typeof ctx.home.featured>[])
                  : ctx.home.latest.length > 0
                    ? ctx.home.latest
                    : ([ctx.home.featured, ...ctx.home.secondary].filter(
                        Boolean,
                      ) as NonNullable<typeof ctx.home.featured>[])
              }
            />
          ) : null}
          {ctx.editorialPicks.length > 0 && ctx.home.density !== "minimal" ? (
            <HomeMostRead articles={ctx.editorialPicks} />
          ) : null}
        </div>
      );
      return ctx.muted ? mutedSection(body, "news") : plainSection(body, "news");
    }

    case "institutional":
      return plainSection(
        <div className="space-y-20 md:space-y-24">
          <HomeInstitutionalBlock />
          <NewsletterOrFollowBlock />
        </div>,
        "institutional",
      );

    default:
      return null;
  }
}
