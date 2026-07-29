/**
 * Bloques geointeligentes del Home / detalle — Etapa 15.
 * Todos usan @repo/geo (planNearbyQuery / filterNearbyInMemory) + ranking del feed.
 */

import { prisma } from "@repo/db";
import {
  boundingBoxWhere,
  filterNearbyInMemory,
  planNearbyQuery,
} from "@repo/geo/nearby";
import { publicPublishedArticleWhere, publicPublishedEventWhere } from "../distribution/public-rules";
import { FEED_CONFIG } from "./config";
import {
  articleToFeedCandidate,
  eventToFeedCandidate,
  type RawArticleForFeed,
  type RawEventForFeed,
} from "./normalize";
import { compareFeedItems } from "./score";
import type { FeedOrigin, InfoSpotFeedItem, InfoSpotFeedItemType } from "./types";

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

async function loadNearbyRaw(origin: FeedOrigin, radiusKm: number, now: Date) {
  const plan = planNearbyQuery(
    { latitude: origin.latitude, longitude: origin.longitude },
    radiusKm,
  );
  const box = boundingBoxWhere(plan.boundingBox);
  const lookback = new Date(
    now.getTime() - FEED_CONFIG.articleLookbackDays * 24 * 60 * 60 * 1000,
  );

  const [articles, events] = await Promise.all([
    prisma.infoSpotArticle.findMany({
      where: {
        ...publicPublishedArticleWhere(),
        publishedAt: { lte: now, gte: lookback },
        ...box,
      },
      select: articleSelect,
      take: 60,
    }),
    prisma.infoSpotEvent.findMany({
      where: {
        ...publicPublishedEventWhere(),
        ...box,
        OR: [
          { endAt: { gte: now } },
          { endAt: null, startAt: { gte: now } },
        ],
      },
      select: eventSelect,
      take: 60,
    }),
  ]);

  return {
    articles: articles as RawArticleForFeed[],
    events: events as RawEventForFeed[],
    plan,
  };
}

function toCandidates(
  articles: RawArticleForFeed[],
  events: RawEventForFeed[],
  origin: FeedOrigin,
  now: Date,
  excludeIds: Set<string>,
): InfoSpotFeedItem[] {
  const out: InfoSpotFeedItem[] = [];
  for (const a of articles) {
    const item = articleToFeedCandidate(a, origin, now);
    if (!item || excludeIds.has(item.contentKey)) continue;
    out.push(item);
  }
  for (const e of events) {
    const item = eventToFeedCandidate(e, origin, now);
    if (!item || excludeIds.has(item.contentKey)) continue;
    out.push(item);
  }
  return out;
}

/** Contenido mixto cerca de un punto (Home / “También cerca”). */
export async function getNearbyUnifiedContent(options: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  excludeContentKeys?: string[];
  types?: InfoSpotFeedItemType[];
  province?: string | null;
  now?: Date;
}): Promise<InfoSpotFeedItem[]> {
  const now = options.now ?? new Date();
  const radiusKm = options.radiusKm ?? FEED_CONFIG.defaultRadiusKm;
  const limit = options.limit ?? 8;
  const origin: FeedOrigin = {
    latitude: options.latitude,
    longitude: options.longitude,
    mode: "manual",
    province: options.province ?? null,
  };
  const exclude = new Set(options.excludeContentKeys ?? []);
  const { articles, events, plan } = await loadNearbyRaw(origin, radiusKm, now);

  // Refinar con Haversine del motor (no recalcular a mano).
  const articleMatches = filterNearbyInMemory(
    articles.map((a) => ({
      id: a.id,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
    plan.origin,
    radiusKm,
  );
  const eventMatches = filterNearbyInMemory(
    events.map((e) => ({
      id: e.id,
      latitude: e.latitude,
      longitude: e.longitude,
    })),
    plan.origin,
    radiusKm,
  );
  const articleIds = new Set(articleMatches.map((m) => m.item.id));
  const eventIds = new Set(eventMatches.map((m) => m.item.id));

  let items = toCandidates(
    articles.filter((a) => articleIds.has(a.id)),
    events.filter((e) => eventIds.has(e.id)),
    origin,
    now,
    exclude,
  );

  if (options.types?.length) {
    const set = new Set(options.types);
    items = items.filter((i) => set.has(i.type));
  }

  items.sort(compareFeedItems);
  return items.slice(0, limit);
}

/** Próximas actividades cercanas — fecha + distancia. */
export async function getNearbyUpcomingActivities(options: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  now?: Date;
}): Promise<InfoSpotFeedItem[]> {
  const items = await getNearbyUnifiedContent({
    ...options,
    types: ["EVENT", "CONTEST"],
    limit: (options.limit ?? 6) * 2,
  });
  return items
    .filter((i) => i.startsAt && i.startsAt.getTime() >= (options.now ?? new Date()).getTime())
    .sort((a, b) => {
      const ta = a.startsAt?.getTime() ?? 0;
      const tb = b.startsAt?.getTime() ?? 0;
      if (ta !== tb) return ta - tb;
      return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
    })
    .slice(0, options.limit ?? 6);
}

/** Convocatorias abiertas cercanas. */
export async function getNearbyOpenPhotographerCalls(options: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  now?: Date;
}): Promise<InfoSpotFeedItem[]> {
  return getNearbyUnifiedContent({
    ...options,
    types: ["PHOTOGRAPHER_CALL"],
    limit: options.limit ?? 6,
  });
}

/** “También cerca de este lugar” — ancla en una nota georreferenciada. */
export async function getAlsoNearThisPlace(options: {
  latitude: number;
  longitude: number;
  excludeContentKey: string;
  radiusKm?: number;
  limit?: number;
  province?: string | null;
}): Promise<InfoSpotFeedItem[]> {
  return getNearbyUnifiedContent({
    latitude: options.latitude,
    longitude: options.longitude,
    radiusKm: options.radiusKm ?? 40,
    limit: options.limit ?? 6,
    excludeContentKeys: [options.excludeContentKey],
    province: options.province,
  });
}
