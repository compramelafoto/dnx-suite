import type { Metadata } from "next";
import { HomeAdaptiveSections } from "@/components/home";
import { composeHomeEditorial } from "@/lib/home-composition";
import { getHomeEditorialData } from "@/lib/articles";
import {
  getCachedHomepageCore,
  getNearbyEvents,
  getUpcomingEvents,
} from "@/lib/distribution";
import { getCachedPublicFeedGeneral } from "@/lib/feed/server";
import {
  getNearbyOpenPhotographerCalls,
  getNearbyUpcomingActivities,
} from "@/lib/feed/nearby-blocks";
import { parseGeoParams } from "@/lib/geo";
import { getAuthUser } from "@/lib/auth";
import { listActivePublicProfiles } from "@/lib/dnx-user-profiles";
import { resolveHomeExperience } from "@/lib/home-experience";
import { readPreferredHomeModeFromCookie } from "@/app/actions/home-experience";
import { loadInfospotAds } from "@/lib/partners-ads";
import { PartnerAdsSlot } from "@/components/partners/PartnerAdsSlot";
import { PartnerAdsWelcome } from "@/components/partners/PartnerAdsWelcome";
import { PartnerLogoMarquee } from "@repo/design-system/components/partners";

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

  const emptyFeed = {
    items: [] as Awaited<ReturnType<typeof getCachedPublicFeedGeneral>>["items"],
    nextCursor: null as string | null,
    hasMore: false,
  };

  const [
    core,
    editorialData,
    nearby,
    upcomingFallback,
    user,
    preferredMode,
    feed,
    nearbyUpcoming,
    nearbyCalls,
  ] = await Promise.all([
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
    getAuthUser(),
    readPreferredHomeModeFromCookie(),
    getCachedPublicFeedGeneral(12).catch((err) => {
      console.error("[infospot/home] feed unavailable:", err);
      return emptyFeed;
    }),
    near
      ? getNearbyUpcomingActivities({
          latitude: near.lat,
          longitude: near.lng,
          radiusKm: near.radiusKm,
          limit: 6,
        }).catch(() => [])
      : Promise.resolve([]),
    near
      ? getNearbyOpenPhotographerCalls({
          latitude: near.lat,
          longitude: near.lng,
          radiusKm: near.radiusKm,
          limit: 6,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const activeProfiles = user
    ? (await listActivePublicProfiles(user.id)).map((p) => p.profileType)
    : [];

  const experience = resolveHomeExperience({
    activeProfiles,
    preferredMode,
  });

  const home = composeHomeEditorial(editorialData);
  const banners = core.banner;
  const nearEvents = nearby.length > 0 ? nearby : upcomingFallback;

  const audience = near
    ? { countryCode: "AR" as const }
    : { countryCode: "AR" as const };

  const [welcomeAds, homeTopAds, homeInlineAds, marqueeAds] = await Promise.all([
    loadInfospotAds("INFOSPOT_HOME_WELCOME", { audience }),
    loadInfospotAds("INFOSPOT_HOME_TOP", { audience }),
    loadInfospotAds("INFOSPOT_HOME_INLINE", { audience }),
    loadInfospotAds("INFOSPOT_HOME_MARQUEE", { audience }),
  ]);

  /** Evitar duplicar hero / destacados en el feed unificado. */
  const feedExcludeContentKeys = [
    ...banners.map((b) => `${b.kind === "event" ? "event" : "article"}:${b.id}`),
    ...core.featured.slice(0, 3).map((e) => `event:${e.id}`),
    home.featured ? `article:${home.featured.id}` : null,
  ].filter((k): k is string => Boolean(k));

  return (
    <>
      <PartnerAdsWelcome ad={welcomeAds[0] ?? null} />
      <PartnerAdsSlot ads={homeTopAds} variant="banner" label="Publicidad" />
      <HomeAdaptiveSections
        experience={experience}
        banners={banners}
        home={home}
        featured={core.featured}
        upcoming={core.upcoming}
        photographerCalls={core.photographerCalls}
        coverages={core.coverages}
        nearEvents={nearEvents}
        hasUserLocation={Boolean(near)}
        feedItems={feed.items}
        feedNextCursor={feed.nextCursor}
        feedHasMore={feed.hasMore}
        feedExcludeContentKeys={feedExcludeContentKeys}
        nearbyUpcoming={nearbyUpcoming}
        nearbyCalls={nearbyCalls}
      />
      <PartnerAdsSlot
        ads={homeInlineAds}
        variant="card"
        label="Publicidad"
        placementKey="INFOSPOT_HOME_INLINE"
      />
      {marqueeAds.length > 0 ? (
        <section aria-label="Nos acompañan" className="space-y-6 py-10">
          <h2 className="text-center text-lg font-semibold tracking-tight">Nos acompañan</h2>
          <PartnerLogoMarquee
            aria-label="Sponsors"
            items={marqueeAds.map((ad) => ({
              id: ad.creativeId,
              name: ad.partnerName,
              logoUrl: ad.imageUrl ?? null,
              href: ad.href ?? null,
              campaignId: ad.campaignId,
              creativeId: ad.creativeId,
              placementKey: "INFOSPOT_HOME_MARQUEE",
            }))}
          />
        </section>
      ) : null}
    </>
  );
}
