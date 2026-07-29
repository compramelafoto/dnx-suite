/**
 * Normalización Article/Event → InfoSpotFeedItem (sin copiar a otra tabla).
 */

import { resolveEventCoords } from "../geo";
import { buildPublicEventLocation } from "../geolocation/public-location";
import { resolvePhotographerCallFromSources } from "../distribution/photographer-call";
import { getEventTemporalState, temporalStateLabel } from "../distribution/temporal";
import { classifyArticleFeedType, classifyEventFeedType } from "./classify";
import { calculateDistanceKm, formatDistanceLabel, formatLocationLabel } from "./distance";
import { calculateInfoSpotFeedScore } from "./score";
import {
  FEED_TYPE_LABELS,
  type FeedOrigin,
  type InfoSpotFeedItem,
  type InfoSpotFeedItemType,
} from "./types";

export type RawArticleForFeed = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  editorialPriority: number;
  clfAlbumId: number | null;
  status: string;
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category: { name: string; slug: string } | null;
  coverImage: { url: string; thumbnailUrl: string | null } | null;
  coverageLinks?: { id: string }[];
  author?: {
    city: string | null;
    province: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export type RawEventForFeed = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  startAt: Date;
  endAt: Date | null;
  city: string;
  province: string;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationVisibility?: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  editorialPriority: number;
  registrationUrl: string | null;
  status: string;
  category: { name: string; slug: string } | null;
  photographerCall: {
    enabled: boolean;
    provisioningStatus: string;
    publicUrl: string | null;
    clfEventId: number | null;
    visibility: string;
    joinPolicy: string;
    maxPhotographers: number | null;
    desiredClfStatus: string;
  } | null;
  contentOrigins: {
    externalUrl: string | null;
    externalId: string;
    operationalPayload?: unknown;
  }[];
};

function isFeatured(priority: number): boolean {
  return priority >= 50;
}

function resolveArticleCoords(article: RawArticleForFeed): {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  province: string | null;
  country: string | null;
  national: boolean;
} {
  const scope = article.geographicScope;
  if (scope === "UNSPECIFIED" || scope === "NATIONAL" || scope === "INTERNATIONAL") {
    // Sin proximidad local: tratar como nacional/internacional en el ranking.
    if (
      scope !== "UNSPECIFIED" &&
      typeof article.latitude === "number" &&
      typeof article.longitude === "number"
    ) {
      return {
        latitude: article.latitude,
        longitude: article.longitude,
        city: article.city ?? null,
        province: article.province ?? null,
        country: article.countryName ?? article.countryCode ?? null,
        national: true,
      };
    }
    return {
      latitude: null,
      longitude: null,
      city: article.city ?? null,
      province: article.province ?? null,
      country: article.countryName ?? article.countryCode ?? null,
      national: true,
    };
  }

  // Prioridad: coords editoriales de la nota.
  if (
    typeof article.latitude === "number" &&
    typeof article.longitude === "number" &&
    !(article.latitude === 0 && article.longitude === 0)
  ) {
    return {
      latitude: article.latitude,
      longitude: article.longitude,
      city: article.city ?? null,
      province: article.province ?? null,
      country: article.countryName ?? article.countryCode ?? null,
      national: false,
    };
  }

  // Fallback ciudad/provincia de la nota → centroide.
  if (article.city && article.province) {
    const resolved = resolveEventCoords({
      city: article.city,
      province: article.province,
    });
    if (resolved) {
      return {
        latitude: resolved.lat,
        longitude: resolved.lng,
        city: article.city,
        province: article.province,
        country: article.countryName ?? article.countryCode ?? null,
        national: false,
      };
    }
  }

  // Compat: proxy del autor (notas antiguas sin geo editorial).
  const author = article.author;
  if (
    author &&
    typeof author.latitude === "number" &&
    typeof author.longitude === "number"
  ) {
    return {
      latitude: author.latitude,
      longitude: author.longitude,
      city: author.city,
      province: author.province,
      country: author.country,
      national: false,
    };
  }
  if (author?.city && author?.province) {
    const resolved = resolveEventCoords({
      city: author.city,
      province: author.province,
    });
    if (resolved) {
      return {
        latitude: resolved.lat,
        longitude: resolved.lng,
        city: author.city,
        province: author.province,
        country: author.country,
        national: false,
      };
    }
  }
  return {
    latitude: null,
    longitude: null,
    city: article.city ?? author?.city ?? null,
    province: article.province ?? author?.province ?? null,
    country: article.countryName ?? article.countryCode ?? author?.country ?? null,
    national: true,
  };
}

export function articleToFeedCandidate(
  article: RawArticleForFeed,
  origin: FeedOrigin | null,
  now: Date,
): InfoSpotFeedItem | null {
  if (article.status !== "PUBLISHED" || !article.publishedAt) return null;
  if (article.publishedAt.getTime() > now.getTime()) return null;

  const type = classifyArticleFeedType({
    categorySlug: article.category?.slug,
    categoryName: article.category?.name,
    title: article.title,
    hasCoverageLink: (article.coverageLinks?.length ?? 0) > 0,
    clfAlbumId: article.clfAlbumId,
  });

  const geo = resolveArticleCoords(article);
  const distanceKm =
    origin && geo.latitude != null && geo.longitude != null
      ? calculateDistanceKm(
          origin.latitude,
          origin.longitude,
          geo.latitude,
          geo.longitude,
        )
      : null;

  const score = calculateInfoSpotFeedScore({
    publishedAt: article.publishedAt,
    distanceKm,
    isFeatured: isFeatured(article.editorialPriority),
    editorialPriority: article.editorialPriority,
    startsAt: null,
    endsAt: null,
    itemType: type,
    now,
    isFuturePublication: false,
    originLatitude: origin?.latitude,
    originLongitude: origin?.longitude,
    itemLatitude: geo.latitude,
    itemLongitude: geo.longitude,
    geographicScope: article.geographicScope ?? (geo.national ? "NATIONAL" : "LOCAL"),
    userProvince: origin?.province,
    itemProvince: geo.province,
    debugId: `article:${article.id}`,
  });
  if (score.excluded) return null;

  const national = geo.national || (geo.latitude == null && geo.longitude == null);
  const locationLabel = formatLocationLabel({
    city: geo.city,
    province: geo.province,
    country: geo.country,
    distanceKm,
    national,
  });

  return {
    id: `article:${article.id}`,
    contentKey: `article:${article.id}`,
    type,
    typeLabel: FEED_TYPE_LABELS[type],
    title: article.title,
    excerpt: article.excerpt,
    slug: article.slug,
    publicUrl: `/noticias/${article.slug}`,
    imageUrl:
      article.coverImage?.thumbnailUrl || article.coverImage?.url || null,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    startsAt: null,
    endsAt: null,
    latitude: geo.latitude,
    longitude: geo.longitude,
    city: geo.city,
    province: geo.province,
    country: geo.country,
    isFeatured: isFeatured(article.editorialPriority),
    editorialPriority: article.editorialPriority,
    isTimeSensitive: false,
    statusLabel: null,
    locationLabel,
    distanceKm,
    distanceLabel: formatDistanceLabel(distanceKm),
    rankingScore: score.total,
    geographicScope:
      article.geographicScope ?? (geo.national ? "NATIONAL" : "LOCAL"),
    rankingExplain:
      process.env.NODE_ENV === "development" ? (score.explain ?? null) : null,
  };
}

export function eventToFeedCandidate(
  event: RawEventForFeed,
  origin: FeedOrigin | null,
  now: Date,
): InfoSpotFeedItem | null {
  if (event.status !== "PUBLISHED") return null;

  const call = resolvePhotographerCallFromSources({
    registrationUrl: event.registrationUrl,
    photographerCall: event.photographerCall,
    origin: event.contentOrigins[0] ?? null,
  });

  const type = classifyEventFeedType({
    seekingPhotographers: call.eligible,
    categorySlug: event.category?.slug,
    categoryName: event.category?.name,
    title: event.title,
  });

  const temporal = getEventTemporalState({
    startAt: event.startAt,
    endAt: event.endAt,
    now,
  });
  const isExpired = temporal === "FINISHED" || temporal === "CANCELLED";
  if (type === "PHOTOGRAPHER_CALL" && !call.eligible) return null;

  // Distancia con coords internas; coords públicas respetan locationVisibility.
  const coords = resolveEventCoords({
    latitude: event.latitude,
    longitude: event.longitude,
    city: event.city,
    province: event.province,
  });
  const publicLoc = buildPublicEventLocation({
    city: event.city,
    province: event.province,
    venueName: null,
    address: null,
    latitude: event.latitude,
    longitude: event.longitude,
    locationVisibility: (event.locationVisibility as
      | "EXACT"
      | "APPROXIMATE"
      | "CITY_ONLY"
      | "HIDDEN"
      | null) ?? "CITY_ONLY",
  });

  const distanceKm =
    origin && coords
      ? calculateDistanceKm(
          origin.latitude,
          origin.longitude,
          coords.lat,
          coords.lng,
        )
      : null;

  const publishedAt = event.publishedAt ?? event.updatedAt;
  const score = calculateInfoSpotFeedScore({
    publishedAt,
    distanceKm,
    isFeatured: isFeatured(event.editorialPriority),
    editorialPriority: event.editorialPriority,
    startsAt: event.startAt,
    endsAt: event.endAt,
    itemType: type,
    now,
    isExpired,
    originLatitude: origin?.latitude,
    originLongitude: origin?.longitude,
    itemLatitude: coords?.lat ?? null,
    itemLongitude: coords?.lng ?? null,
    geographicScope: "LOCAL",
    userProvince: origin?.province,
    itemProvince: event.province,
    debugId: `event:${event.id}`,
  });
  if (score.excluded) return null;

  const locationLabel =
    formatDistanceLabel(distanceKm) ||
    publicLoc.label ||
    formatLocationLabel({
      city: publicLoc.city,
      province: publicLoc.province,
      country: event.countryName,
      distanceKm: null,
    });

  return {
    id: `event:${event.id}`,
    contentKey: `event:${event.id}`,
    type,
    typeLabel: FEED_TYPE_LABELS[type],
    title: event.title,
    excerpt: event.summary,
    slug: event.slug,
    publicUrl: `/eventos/${event.slug}`,
    imageUrl: event.coverImageUrl,
    publishedAt,
    updatedAt: event.updatedAt,
    startsAt: event.startAt,
    endsAt: event.endAt,
    latitude: publicLoc.showCoordinates ? publicLoc.latitude : null,
    longitude: publicLoc.showCoordinates ? publicLoc.longitude : null,
    city: publicLoc.city,
    province: publicLoc.province,
    country: event.countryName,
    isFeatured: isFeatured(event.editorialPriority),
    editorialPriority: event.editorialPriority,
    isTimeSensitive: true,
    statusLabel:
      type === "PHOTOGRAPHER_CALL"
        ? call.slotsLabel || "Convocatoria abierta"
        : temporalStateLabel(temporal) || null,
    locationLabel,
    distanceKm,
    distanceLabel: formatDistanceLabel(distanceKm),
    rankingScore: score.total,
    geographicScope: "LOCAL",
    rankingExplain:
      process.env.NODE_ENV === "development" ? (score.explain ?? null) : null,
  };
}

export function toFeedItemDto(item: InfoSpotFeedItem) {
  return {
    ...item,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt?.toISOString() ?? null,
    startsAt: item.startsAt?.toISOString() ?? null,
    endsAt: item.endsAt?.toISOString() ?? null,
  };
}

export function filterByTypes(
  items: InfoSpotFeedItem[],
  types?: InfoSpotFeedItemType[],
): InfoSpotFeedItem[] {
  if (!types || types.length === 0) return items;
  const set = new Set(types);
  return items.filter((i) => set.has(i.type));
}
