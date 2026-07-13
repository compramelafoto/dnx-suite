/**
 * Queries y resolvers del motor de distribución (sin React).
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@repo/db";
import { buildPublicEventLocation } from "../geolocation";
import { distanceBetweenCoordinates } from "../geolocation/distance";
import { publicPublishedArticleWhere, publicPublishedEventWhere } from "./public-rules";
import { calculateEventRelevanceScore } from "./score";
import { resolvePhotographerCallFromSources } from "./photographer-call";
import { getEventTemporalState, temporalStateLabel } from "./temporal";
import { sumRecentMetrics } from "./metrics";
import type {
  DistributionBannerItem,
  DistributionCoverageCard,
  DistributionEventCard,
} from "./types";

const eventCardSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  startAt: true,
  endAt: true,
  city: true,
  province: true,
  coverImageUrl: true,
  registrationUrl: true,
  publishedAt: true,
  description: true,
  categoryId: true,
  editorialPriority: true,
  locationConfirmedAt: true,
  locationVisibility: true,
  latitude: true,
  longitude: true,
  venueName: true,
  address: true,
  category: { select: { name: true, slug: true } },
  photographerCall: {
    select: {
      enabled: true,
      provisioningStatus: true,
      publicUrl: true,
      clfEventId: true,
      visibility: true,
      joinPolicy: true,
      maxPhotographers: true,
      desiredClfStatus: true,
    },
  },
  contentOrigins: {
    where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      externalUrl: true,
      externalId: true,
      operationalPayload: true,
    },
  },
} as const;

type EventRow = Awaited<
  ReturnType<typeof prisma.infoSpotEvent.findMany<{ select: typeof eventCardSelect }>>
>[number];

function toCard(
  row: EventRow,
  opts?: {
    distanceKm?: number | null;
    score?: number | null;
    seeking?: boolean;
    joinUrl?: string | null;
    slotsLabel?: string | null;
  },
): DistributionEventCard {
  const call = resolvePhotographerCallFromSources({
    registrationUrl: row.registrationUrl,
    photographerCall: row.photographerCall,
    origin: row.contentOrigins[0] ?? null,
  });
  const seeking = opts?.seeking ?? call.eligible;
  const temporal = getEventTemporalState({ startAt: row.startAt, endAt: row.endAt });
  const publicLoc = buildPublicEventLocation({
    city: row.city,
    province: row.province,
    venueName: row.venueName,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    locationVisibility: row.locationVisibility,
  });
  const distanceKm = opts?.distanceKm ?? null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    startAt: row.startAt,
    endAt: row.endAt,
    city: row.city,
    province: row.province,
    coverImageUrl: row.coverImageUrl,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    temporalState: temporal,
    temporalLabel: temporalStateLabel(temporal),
    seekingPhotographers: seeking,
    registrationUrl: row.registrationUrl,
    clfJoinUrl: opts?.joinUrl ?? call.joinUrl,
    distanceKm,
    distanceLabel:
      distanceKm != null
        ? `A ${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km de tu ubicación`
        : null,
    locationLabel: publicLoc.label,
    locationVisibility: row.locationVisibility,
    score: opts?.score ?? null,
    slotsLabel: opts?.slotsLabel ?? call.slotsLabel,
  };
}

async function loadHomepageEvents(take = 60): Promise<EventRow[]> {
  const now = new Date();
  return prisma.infoSpotEvent.findMany({
    where: publicPublishedEventWhere({
      OR: [{ startAt: { gte: now } }, { endAt: { gte: now } }],
    }),
    orderBy: [{ editorialPriority: "desc" }, { startAt: "asc" }],
    take,
    select: eventCardSelect,
  });
}

export async function getUpcomingEvents(options?: {
  limit?: number;
  categorySlug?: string;
  city?: string;
}): Promise<DistributionEventCard[]> {
  const now = new Date();
  const limit = options?.limit ?? 8;
  const rows = await prisma.infoSpotEvent.findMany({
    where: publicPublishedEventWhere({
      startAt: { gte: now },
      ...(options?.categorySlug
        ? { category: { slug: options.categorySlug } }
        : {}),
      ...(options?.city
        ? { city: { equals: options.city, mode: "insensitive" as const } }
        : {}),
    }),
    orderBy: [{ startAt: "asc" }, { publishedAt: "desc" }],
    take: limit,
    select: eventCardSelect,
  });
  return rows
    .map((r) => toCard(r))
    .filter((c) => c.temporalState === "UPCOMING" || c.temporalState === "TODAY");
}

export async function getFeaturedEvents(options?: {
  limit?: number;
}): Promise<DistributionEventCard[]> {
  const limit = options?.limit ?? 4;
  const rows = await loadHomepageEvents(80);
  const eventIds = rows.map((r) => r.id);
  const [views, clicks] = await Promise.all([
    sumRecentMetrics({ kind: "EVENT_VIEW", eventIds, days: 14 }),
    sumRecentMetrics({ kind: "CLF_REGISTRATION_CLICK", eventIds, days: 14 }),
  ]);

  const scored = rows.map((row) => {
    const call = resolvePhotographerCallFromSources({
      registrationUrl: row.registrationUrl,
      photographerCall: row.photographerCall,
      origin: row.contentOrigins[0] ?? null,
    });
    const breakdown = calculateEventRelevanceScore({
      startAt: row.startAt,
      endAt: row.endAt,
      publishedAt: row.publishedAt,
      coverImageUrl: row.coverImageUrl,
      locationConfirmedAt: row.locationConfirmedAt,
      categoryId: row.categoryId,
      description: row.description,
      registrationUrl: row.registrationUrl || call.joinUrl,
      editorialPriority: row.editorialPriority,
      seekingPhotographers: call.eligible,
      recentViews: views.get(`event:${row.id}`) ?? 0,
      registrationClicks: clicks.get(`event:${row.id}`) ?? 0,
    });
    return toCard(row, {
      score: breakdown.total,
      seeking: call.eligible,
      joinUrl: call.joinUrl,
      slotsLabel: call.slotsLabel,
    });
  });

  return scored
    .filter((c) => c.temporalState !== "FINISHED")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export async function getPhotographerCallEvents(options?: {
  limit?: number;
}): Promise<DistributionEventCard[]> {
  const limit = options?.limit ?? 6;
  const rows = await loadHomepageEvents(100);
  const cards: DistributionEventCard[] = [];
  for (const row of rows) {
    const call = resolvePhotographerCallFromSources({
      registrationUrl: row.registrationUrl,
      photographerCall: row.photographerCall,
      origin: row.contentOrigins[0] ?? null,
    });
    if (!call.eligible || !call.joinUrl) continue;
    const temporal = getEventTemporalState({ startAt: row.startAt, endAt: row.endAt });
    if (temporal === "FINISHED") continue;
    cards.push(
      toCard(row, {
        seeking: true,
        joinUrl: call.joinUrl,
        slotsLabel: call.slotsLabel,
      }),
    );
    if (cards.length >= limit) break;
  }
  return cards;
}

export async function getNearbyEvents(options: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}): Promise<DistributionEventCard[]> {
  const radiusKm = options.radiusKm ?? 100;
  const limit = options.limit ?? 8;
  const now = new Date();
  const rows = await prisma.infoSpotEvent.findMany({
    where: publicPublishedEventWhere({
      startAt: { gte: now },
      locationConfirmedAt: { not: null },
      latitude: { not: null },
      longitude: { not: null },
    }),
    orderBy: { startAt: "asc" },
    take: 120,
    select: eventCardSelect,
  });

  const origin = { latitude: options.latitude, longitude: options.longitude };
  const withDist = rows
    .map((row) => {
      if (row.latitude == null || row.longitude == null) return null;
      // Distancia en servidor aunque visibility sea HIDDEN (no se exponen coords).
      const distanceKm = distanceBetweenCoordinates(origin, {
        latitude: row.latitude,
        longitude: row.longitude,
      });
      if (distanceKm > radiusKm) return null;
      return { row, distanceKm };
    })
    .filter((x): x is { row: EventRow; distanceKm: number } => x != null)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.row.startAt.getTime() - b.row.startAt.getTime())
    .slice(0, limit);

  return withDist.map(({ row, distanceKm }) => toCard(row, { distanceKm }));
}

export async function getRecentEventCoverage(options?: {
  limit?: number;
}): Promise<DistributionCoverageCard[]> {
  const limit = options?.limit ?? 6;
  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      ...publicPublishedArticleWhere(),
      OR: [
        { eventId: { not: null } },
        {
          contentOrigins: {
            some: {
              sourceType: "COMPRAMELAFOTO",
              externalEntityType: "EVENT",
            },
          },
        },
      ],
    },
    orderBy: [{ publishedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      eventId: true,
      coverImage: { select: { url: true, credit: true } },
      author: { select: { name: true } },
      contentOrigins: {
        where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
        take: 1,
        select: {
          externalId: true,
          operationalPayload: true,
        },
      },
      editorialPhotoUsages: {
        where: { usageType: "COVER" },
        take: 1,
        include: {
          photo: {
            include: {
              variants: {
                where: { format: "webp" },
                orderBy: { width: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      coverageLinks: {
        take: 1,
        select: {
          coverage: {
            select: {
              commercialStatus: true,
              canShowPurchaseCta: true,
              photographers: { take: 1, select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  const clfIds = [
    ...new Set(
      articles
        .map((a) =>
          a.eventId != null
            ? String(a.eventId)
            : a.contentOrigins[0]?.externalId || null,
        )
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  const linkedOrigins =
    clfIds.length === 0
      ? []
      : await prisma.infoSpotContentOrigin.findMany({
          where: {
            contentType: "EVENT",
            sourceType: "COMPRAMELAFOTO",
            externalEntityType: "EVENT",
            externalId: { in: clfIds },
          event: {
            status: "PUBLISHED",
            excludeFromHomepage: false,
          },
          },
          select: {
            externalId: true,
            event: {
              select: { title: true, city: true, slug: true },
            },
          },
        });

  const byClfId = new Map(
    linkedOrigins
      .filter((o) => o.event)
      .map((o) => [o.externalId, o.event!] as const),
  );

  return articles.map((a) => {
    const origin = a.contentOrigins[0];
    const clfId =
      a.eventId != null ? String(a.eventId) : origin?.externalId || null;
    const linked = clfId ? byClfId.get(clfId) : undefined;
    const payload = (origin?.operationalPayload ?? null) as Record<
      string,
      unknown
    > | null;
    const coverUsage = a.editorialPhotoUsages[0];
    const coverReady =
      coverUsage?.photo.editorialLicenseStatus === "AUTHORIZED" &&
      coverUsage?.photo.processStatus === "READY" &&
      coverUsage.photo.variants[0]?.url;
    const cov = a.coverageLinks[0]?.coverage;
    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      publishedAt: a.publishedAt,
      coverImageUrl: coverReady || a.coverImage?.url || null,
      coverCredit: coverUsage?.photo.credit || a.coverImage?.credit || null,
      authorName: a.author?.name ?? null,
      photographerName:
        coverUsage?.photo.photographerName ||
        cov?.photographers[0]?.displayName ||
        null,
      photosAvailable: Boolean(
        cov?.canShowPurchaseCta && cov.commercialStatus === "AVAILABLE",
      ),
      relatedEventTitle:
        linked?.title ||
        (typeof payload?.title === "string" ? payload.title : null),
      relatedEventCity:
        linked?.city ||
        (typeof payload?.city === "string" ? payload.city : null),
      relatedEventSlug: linked?.slug ?? null,
    };
  });
}

function placementActiveNow(
  p: { startsAt: Date | null; endsAt: Date | null; isActive: boolean },
  now: Date,
): boolean {
  if (!p.isActive) return false;
  if (p.startsAt && p.startsAt > now) return false;
  if (p.endsAt && p.endsAt < now) return false;
  return true;
}

export async function getHomepageBannerItems(options?: {
  limit?: number;
}): Promise<DistributionBannerItem[]> {
  const limit = options?.limit ?? 3;
  const now = new Date();

  const placements = await prisma.infoSpotHomepagePlacement.findMany({
    where: {
      placementType: "HERO",
      isActive: true,
    },
    orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 20,
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          status: true,
          contentTag: true,
          excludeFromHomepage: true,
          coverImage: { select: { url: true } },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          status: true,
          contentTag: true,
          excludeFromHomepage: true,
          coverImageUrl: true,
        },
      },
    },
  });

  const fromPlacement: DistributionBannerItem[] = [];
  for (const p of placements) {
    if (!placementActiveNow(p, now)) continue;
    if (p.event) {
      if (
        p.event.status !== "PUBLISHED" ||
        p.event.excludeFromHomepage
      ) {
        continue;
      }
      fromPlacement.push({
        id: p.event.id,
        placementId: p.id,
        kind: "event",
        title: p.customTitle || p.event.title,
        subtitle: p.customSubtitle || p.event.summary,
        href: `/eventos/${p.event.slug}`,
        imageUrl: p.customImageUrl || p.event.coverImageUrl,
        source: "placement",
      });
    } else if (p.article) {
      if (
        p.article.status !== "PUBLISHED" ||
        p.article.excludeFromHomepage
      ) {
        continue;
      }
      fromPlacement.push({
        id: p.article.id,
        placementId: p.id,
        kind: "article",
        title: p.customTitle || p.article.title,
        subtitle: p.customSubtitle || p.article.excerpt,
        href: `/noticias/${p.article.slug}`,
        imageUrl: p.customImageUrl || p.article.coverImage?.url || null,
        source: "placement",
      });
    }
    if (fromPlacement.length >= limit) break;
  }

  if (fromPlacement.length > 0) return fromPlacement;

  // Fallbacks (nunca DEMO)
  const featured = await getFeaturedEvents({ limit: 1 });
  if (featured[0]) {
    return [
      {
        id: featured[0].id,
        placementId: null,
        kind: "event",
        title: featured[0].title,
        subtitle: featured[0].summary,
        href: `/eventos/${featured[0].slug}`,
        imageUrl: featured[0].coverImageUrl,
        source: "fallback",
      },
    ];
  }

  const article = await prisma.infoSpotArticle.findFirst({
    where: publicPublishedArticleWhere({
      editorialPriority: { gt: 0 },
    }),
    orderBy: [{ editorialPriority: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: { select: { url: true } },
    },
  });
  if (article) {
    return [
      {
        id: article.id,
        placementId: null,
        kind: "article",
        title: article.title,
        subtitle: article.excerpt,
        href: `/noticias/${article.slug}`,
        imageUrl: article.coverImage?.url ?? null,
        source: "fallback",
      },
    ];
  }

  const upcoming = await getUpcomingEvents({ limit: 1 });
  if (upcoming[0]) {
    return [
      {
        id: upcoming[0].id,
        placementId: null,
        kind: "event",
        title: upcoming[0].title,
        subtitle: upcoming[0].summary,
        href: `/eventos/${upcoming[0].slug}`,
        imageUrl: upcoming[0].coverImageUrl,
        source: "fallback",
      },
    ];
  }

  return [];
}

export type HomepageDistributionPayload = {
  banner: DistributionBannerItem[];
  upcoming: DistributionEventCard[];
  featured: DistributionEventCard[];
  photographerCalls: DistributionEventCard[];
  nearby: DistributionEventCard[];
  coverages: DistributionCoverageCard[];
};

export async function getHomepageDistribution(opts?: {
  near?: { latitude: number; longitude: number; radiusKm?: number } | null;
}): Promise<HomepageDistributionPayload> {
  const [banner, upcoming, featured, photographerCalls, coverages, nearby] =
    await Promise.all([
      getHomepageBannerItems({ limit: 1 }),
      getUpcomingEvents({ limit: 8 }),
      getFeaturedEvents({ limit: 4 }),
      getPhotographerCallEvents({ limit: 6 }),
      getRecentEventCoverage({ limit: 6 }),
      opts?.near
        ? getNearbyEvents({
            latitude: opts.near.latitude,
            longitude: opts.near.longitude,
            radiusKm: opts.near.radiusKm,
            limit: 6,
          })
        : Promise.resolve([] as DistributionEventCard[]),
    ]);

  return {
    banner,
    upcoming,
    featured,
    photographerCalls,
    nearby,
    coverages,
  };
}

/** Cache corta para bloques no personalizados. */
export const getCachedHomepageCore = unstable_cache(
  async () => {
    const [banner, upcoming, featured, photographerCalls, coverages] =
      await Promise.all([
        getHomepageBannerItems({ limit: 1 }),
        getUpcomingEvents({ limit: 8 }),
        getFeaturedEvents({ limit: 4 }),
        getPhotographerCallEvents({ limit: 6 }),
        getRecentEventCoverage({ limit: 6 }),
      ]);
    return { banner, upcoming, featured, photographerCalls, coverages };
  },
  ["infospot-homepage-core-v1"],
  { revalidate: 120, tags: ["infospot-home", "infospot-home-core"] },
);

export const getCachedPhotographerCalls = unstable_cache(
  async () => getPhotographerCallEvents({ limit: 6 }),
  ["infospot-home-photographer-calls-v1"],
  { revalidate: 60, tags: ["infospot-home", "infospot-home-calls"] },
);
