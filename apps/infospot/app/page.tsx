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
  const banner = core.banner[0] ?? null;
  const nearEvents = nearby.length > 0 ? nearby : upcomingFallback;

  /** Evitar duplicar hero / destacados en el feed unificado. */
  const feedExcludeContentKeys = [
    banner
      ? `${banner.kind === "event" ? "event" : "article"}:${banner.id}`
      : null,
    ...core.featured.slice(0, 3).map((e) => `event:${e.id}`),
    home.featured ? `article:${home.featured.id}` : null,
  ].filter((k): k is string => Boolean(k));

  return (
    <HomeAdaptiveSections
      experience={experience}
      banner={banner}
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
  );
}
