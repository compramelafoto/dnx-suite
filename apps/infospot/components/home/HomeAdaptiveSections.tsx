import { Suspense, type ReactNode } from "react";
import {
  HomeCategoryBlocks,
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
import { HomeExperienceSwitcher } from "@/components/home/HomeExperienceSwitcher";
import { NewsletterOrFollowBlock } from "@/components/editorial/newsletter-follow-block";
import { EditorialContainer, Section } from "@/components/foundations";
import type { HomeComposition } from "@/lib/home-composition";
import type { HomeBlockId, HomeExperience } from "@/lib/home-experience";
import type { PublicProfileType } from "@/lib/dnx-user-profiles";

type BannerItem = Parameters<typeof HomeEditorialBanner>[0]["item"];
type EventList = Parameters<typeof HomeFeaturedEvents>[0]["events"];
type CallList = Parameters<typeof HomePhotographersCall>[0]["events"];
type CoverageList = Parameters<typeof HomeLatestCoverages>[0]["coverages"];
type NearList = Parameters<typeof HomeNearYouBlock>[0]["events"];

type Props = {
  experience: HomeExperience;
  banner: BannerItem | null;
  home: HomeComposition;
  featured: EventList;
  upcoming: EventList;
  photographerCalls: CallList;
  coverages: CoverageList;
  nearEvents: NearList;
  hasUserLocation: boolean;
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
  banner,
  home,
  featured,
  upcoming,
  photographerCalls,
  coverages,
  nearEvents,
  hasUserLocation,
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
      banner,
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
    banner: BannerItem | null;
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
  },
): ReactNode {
  switch (block) {
    case "hero":
      return ctx.banner ? (
        <HomeEditorialBanner key="hero" item={ctx.banner} />
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

    case "near_you":
      return ctx.muted
        ? mutedSection(
            <Suspense fallback={null}>
              <HomeNearYouBlock
                events={ctx.nearEvents}
                hasUserLocation={ctx.hasUserLocation}
              />
            </Suspense>,
            "near_you",
          )
        : plainSection(
            <Suspense fallback={null}>
              <HomeNearYouBlock
                events={ctx.nearEvents}
                hasUserLocation={ctx.hasUserLocation}
              />
            </Suspense>,
            "near_you",
          );

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
