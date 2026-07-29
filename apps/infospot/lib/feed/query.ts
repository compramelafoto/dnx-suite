/**
 * Agregador del feed unificado (artículos + eventos públicos).
 * Etapa 15: ranking vía @repo/geo + candidatos locales por bbox.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@repo/db";
import { boundingBoxWhere, planNearbyQuery } from "@repo/geo/nearby";
import { publicPublishedArticleWhere, publicPublishedEventWhere } from "../distribution/public-rules";
import { FEED_CONFIG } from "./config";
import { decodeFeedCursor, encodeFeedCursor, isAfterFeedCursor } from "./cursor";
import { diversifyFeedTypes } from "./diversity";
import { buildFeedMetrics, logFeedMetricsDev } from "./metrics";
import {
  articleToFeedCandidate,
  eventToFeedCandidate,
  filterByTypes,
  type RawArticleForFeed,
  type RawEventForFeed,
} from "./normalize";
import { compareFeedItems } from "./score";
import type {
  FeedLocationMode,
  FeedOrigin,
  GetPublicFeedInput,
  GetPublicFeedResult,
  InfoSpotFeedItem,
} from "./types";

const articleSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
  updatedAt: true,
  editorialPriority: true,
  clfAlbumId: true,
  status: true,
  geographicScope: true,
  countryCode: true,
  countryName: true,
  province: true,
  city: true,
  latitude: true,
  longitude: true,
  category: { select: { name: true, slug: true } },
  coverImage: { select: { url: true, thumbnailUrl: true } },
  coverageLinks: { select: { id: true }, take: 1 },
  author: {
    select: {
      city: true,
      province: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  startAt: true,
  endAt: true,
  city: true,
  province: true,
  countryName: true,
  latitude: true,
  longitude: true,
  locationVisibility: true,
  coverImageUrl: true,
  publishedAt: true,
  updatedAt: true,
  editorialPriority: true,
  registrationUrl: true,
  status: true,
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

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of primary) map.set(row.id, row);
  for (const row of extra) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

async function loadFeedCandidates(
  now: Date,
  origin: FeedOrigin | null,
  radiusKm: number,
): Promise<{
  articles: RawArticleForFeed[];
  events: RawEventForFeed[];
}> {
  const lookback = new Date(
    now.getTime() - FEED_CONFIG.articleLookbackDays * 24 * 60 * 60 * 1000,
  );

  const [articles, events] = await Promise.all([
    prisma.infoSpotArticle.findMany({
      where: {
        ...publicPublishedArticleWhere(),
        publishedAt: { lte: now, gte: lookback },
      },
      select: articleSelect,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: FEED_CONFIG.candidateLimit.articles,
    }),
    prisma.infoSpotEvent.findMany({
      where: {
        ...publicPublishedEventWhere(),
        OR: [
          { endAt: { gte: now } },
          { endAt: null, startAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
        ],
      },
      select: eventSelect,
      orderBy: [{ startAt: "asc" }, { publishedAt: "desc" }],
      take: FEED_CONFIG.candidateLimit.events,
    }),
  ]);

  if (!origin) {
    return {
      articles: articles as RawArticleForFeed[],
      events: events as RawEventForFeed[],
    };
  }

  // Prefetch espacial: asegura locales aunque no entren en el top por fecha.
  const plan = planNearbyQuery(
    { latitude: origin.latitude, longitude: origin.longitude },
    radiusKm,
  );
  const box = boundingBoxWhere(plan.boundingBox);

  const [nearbyArticles, nearbyEvents] = await Promise.all([
    prisma.infoSpotArticle.findMany({
      where: {
        ...publicPublishedArticleWhere(),
        publishedAt: { lte: now, gte: lookback },
        OR: [
          { ...box },
          {
            geographicScope: { in: ["NATIONAL", "INTERNATIONAL", "UNSPECIFIED"] },
          },
        ],
      },
      select: articleSelect,
      orderBy: [{ publishedAt: "desc" }],
      take: FEED_CONFIG.candidateLimit.nearbyArticles,
    }),
    prisma.infoSpotEvent.findMany({
      where: {
        ...publicPublishedEventWhere(),
        ...box,
        OR: [
          { endAt: { gte: now } },
          { endAt: null, startAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
        ],
      },
      select: eventSelect,
      orderBy: [{ startAt: "asc" }],
      take: FEED_CONFIG.candidateLimit.nearbyEvents,
    }),
  ]);

  return {
    articles: mergeById(
      articles as RawArticleForFeed[],
      nearbyArticles as RawArticleForFeed[],
    ),
    events: mergeById(events as RawEventForFeed[], nearbyEvents as RawEventForFeed[]),
  };
}

function resolveOrigin(input: GetPublicFeedInput): {
  origin: FeedOrigin | null;
  locationMode: FeedLocationMode;
  personalized: boolean;
} {
  const mode = input.locationMode ?? "none";
  if (mode === "national" || mode === "none") {
    return { origin: null, locationMode: mode, personalized: false };
  }
  if (
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return {
      origin: {
        latitude: input.lat,
        longitude: input.lng,
        mode: mode === "manual" ? "manual" : "gps",
        province: input.userProvince ?? null,
      },
      locationMode: mode === "manual" ? "manual" : "gps",
      personalized: true,
    };
  }
  return { origin: null, locationMode: "none", personalized: false };
}

function buildRankedFeed(
  articles: RawArticleForFeed[],
  events: RawEventForFeed[],
  origin: FeedOrigin | null,
  now: Date,
  excludeContentKeys: Set<string>,
  types?: GetPublicFeedInput["types"],
  radiusKm?: number | null,
): { items: InfoSpotFeedItem[]; distanceCalculations: number } {
  const candidates: InfoSpotFeedItem[] = [];
  let distanceCalculations = 0;

  for (const article of articles) {
    const item = articleToFeedCandidate(article, origin, now);
    if (!item) continue;
    if (excludeContentKeys.has(item.contentKey)) continue;
    if (item.distanceKm != null) distanceCalculations += 1;
    candidates.push(item);
  }

  for (const event of events) {
    const item = eventToFeedCandidate(event, origin, now);
    if (!item) continue;
    if (excludeContentKeys.has(item.contentKey)) continue;
    if (item.distanceKm != null) distanceCalculations += 1;
    candidates.push(item);
  }

  let filtered = filterByTypes(candidates, types);

  // Soft: el hard filter solo si se activa en config (bloques nearby usan otro path).
  if (
    FEED_CONFIG.ranking.applyHardRadiusFilter &&
    origin &&
    typeof radiusKm === "number" &&
    Number.isFinite(radiusKm)
  ) {
    filtered = filtered.filter(
      (item) =>
        item.distanceKm == null ||
        item.geographicScope === "NATIONAL" ||
        item.geographicScope === "INTERNATIONAL" ||
        item.geographicScope === "UNSPECIFIED" ||
        item.distanceKm <= radiusKm,
    );
  }

  filtered.sort(compareFeedItems);
  return { items: diversifyFeedTypes(filtered), distanceCalculations };
}

/**
 * Obtiene una página del feed público rankeado.
 */
export async function getPublicFeed(
  input: GetPublicFeedInput = {},
): Promise<GetPublicFeedResult> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const limit = Math.min(
    FEED_CONFIG.page.maxLimit,
    Math.max(1, input.limit ?? FEED_CONFIG.page.defaultLimit),
  );
  const { origin, locationMode, personalized } = resolveOrigin(input);
  const exclude = new Set(input.excludeContentKeys ?? []);
  const cursor = decodeFeedCursor(input.cursor);
  const radiusKm = Math.min(
    FEED_CONFIG.maxRadiusKm,
    Math.max(
      5,
      input.radiusKm ?? FEED_CONFIG.defaultRadiusKm,
    ),
  );

  const { articles, events } = await loadFeedCandidates(now, origin, radiusKm);
  const { items: ranked, distanceCalculations } = buildRankedFeed(
    articles,
    events,
    origin,
    now,
    exclude,
    input.types,
    input.radiusKm,
  );

  let start = 0;
  if (cursor) {
    const idx = ranked.findIndex((item) => isAfterFeedCursor(item, cursor));
    start = idx >= 0 ? idx : ranked.length;
  }

  const page = ranked.slice(start, start + limit);
  const hasMore = start + limit < ranked.length;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeFeedCursor({
          v: 1,
          score: last.rankingScore,
          publishedAt: last.publishedAt.toISOString(),
          id: last.id,
        })
      : null;

  const metrics =
    input.includeMetrics || process.env.NODE_ENV === "development"
      ? buildFeedMetrics({
          startedAt,
          candidatesLoaded: articles.length + events.length,
          distanceCalculations,
          ranked,
          pageSize: page.length,
          locationMode,
          personalized,
        })
      : undefined;

  if (metrics) logFeedMetricsDev(metrics);

  return {
    items: page,
    nextCursor,
    hasMore,
    locationMode,
    personalized,
    metrics,
  };
}

/** Feed general cacheado (SSR Home, sin GPS). */
export const getCachedPublicFeedGeneral = unstable_cache(
  async (limit: number) => {
    const result = await getPublicFeed({
      limit,
      locationMode: "none",
    });
    return {
      ...result,
      metrics: undefined,
      items: result.items.map((item) => ({
        ...item,
        publishedAt: item.publishedAt.toISOString(),
        updatedAt: item.updatedAt?.toISOString() ?? null,
        startsAt: item.startsAt?.toISOString() ?? null,
        endsAt: item.endsAt?.toISOString() ?? null,
        rankingExplain: null,
      })),
    };
  },
  ["infospot-home-feed-general-v2"],
  {
    revalidate: 90,
    tags: [
      "infospot-home",
      "infospot-home-feed",
      "infospot-public-content",
    ],
  },
);

/** Export para tests: ranking puro sin Prisma. */
export function rankFeedCandidatesForTest(
  articles: RawArticleForFeed[],
  events: RawEventForFeed[],
  origin: FeedOrigin | null,
  now: Date,
): InfoSpotFeedItem[] {
  return buildRankedFeed(articles, events, origin, now, new Set()).items;
}
