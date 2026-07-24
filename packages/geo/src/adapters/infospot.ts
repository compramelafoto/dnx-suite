import type { DnxLocation, GeographicScope } from "../types";
import type { GeoFeedItem } from "../feed-item";
import { withGeohash } from "../location";

/** Shape mínimo de nota InfoSpot con geo editorial. */
export type InfoSpotArticleGeoSource = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: Date | null;
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  editorialPriority?: number | null;
  coverImage?: { url?: string | null; thumbnailUrl?: string | null } | null;
};

export type InfoSpotEventGeoSource = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  publishedAt?: Date | null;
  startAt?: Date | null;
  endAt?: Date | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  editorialPriority?: number | null;
  coverImageUrl?: string | null;
};

export function infoSpotArticleToLocation(
  article: InfoSpotArticleGeoSource,
): DnxLocation {
  return withGeohash({
    geographicScope: (article.geographicScope as GeographicScope | null) ?? null,
    countryCode: article.countryCode,
    countryName: article.countryName,
    provinceName: article.province,
    cityName: article.city,
    placeName: article.placeName,
    address: article.address,
    formattedAddress: article.formattedAddress,
    latitude: article.latitude,
    longitude: article.longitude,
    geohash: article.geohash,
  });
}

export function infoSpotEventToLocation(event: InfoSpotEventGeoSource): DnxLocation {
  const hasCoords =
    typeof event.latitude === "number" && typeof event.longitude === "number";
  return withGeohash({
    geographicScope: hasCoords ? "LOCAL" : "UNSPECIFIED",
    countryCode: event.countryCode,
    countryName: event.countryName,
    provinceName: event.province,
    cityName: event.city,
    placeName: event.venueName,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    geohash: event.geohash,
  });
}

export function infoSpotArticleToFeedItem(
  article: InfoSpotArticleGeoSource,
): GeoFeedItem {
  return {
    id: `infospot-article:${article.id}`,
    source: "INFOSPOT_ARTICLE",
    sourceEntityId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    publicUrl: `/noticias/${article.slug}`,
    imageUrl:
      article.coverImage?.thumbnailUrl || article.coverImage?.url || null,
    publishedAt: article.publishedAt ?? null,
    geographicScope: (article.geographicScope as GeographicScope | null) ?? null,
    countryCode: article.countryCode,
    countryName: article.countryName,
    provinceName: article.province,
    cityName: article.city,
    placeName: article.placeName,
    latitude: article.latitude,
    longitude: article.longitude,
    geohash: article.geohash,
    priority: article.editorialPriority ?? 0,
  };
}

export function infoSpotEventToFeedItem(event: InfoSpotEventGeoSource): GeoFeedItem {
  return {
    id: `infospot-event:${event.id}`,
    source: "INFOSPOT_EVENT",
    sourceEntityId: event.id,
    title: event.title,
    excerpt: event.summary,
    publicUrl: `/agenda/${event.slug}`,
    imageUrl: event.coverImageUrl,
    publishedAt: event.publishedAt ?? null,
    startsAt: event.startAt ?? null,
    endsAt: event.endAt ?? null,
    geographicScope: "LOCAL",
    countryCode: event.countryCode,
    countryName: event.countryName,
    provinceName: event.province,
    cityName: event.city,
    placeName: event.venueName,
    latitude: event.latitude,
    longitude: event.longitude,
    geohash: event.geohash,
    priority: event.editorialPriority ?? 0,
  };
}
