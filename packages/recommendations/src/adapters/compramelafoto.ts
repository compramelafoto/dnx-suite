import type { RecommendationItem } from "../types";

export type ClfEventRecSource = {
  id: number | string;
  title: string;
  shareSlug?: string | null;
  city?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  seekingPhotographers?: boolean;
};

export type ClfAlbumRecSource = {
  id: number | string;
  title: string;
  publicSlug?: string | null;
  city?: string | null;
  eventId?: number | null;
};

export function clfEventToRecommendationItem(
  event: ClfEventRecSource,
): RecommendationItem {
  return {
    id: `clf:event:${event.id}`,
    source: "COMPRAMELAFOTO",
    sourceEntityId: String(event.id),
    contentType: event.seekingPhotographers ? "PHOTOGRAPHER_CALL" : "EVENT",
    title: event.title,
    publicUrl: event.shareSlug ? `/e/${event.shareSlug}` : null,
    cityName: event.city,
    provinceName: event.province,
    latitude: event.latitude,
    longitude: event.longitude,
    geohash: event.geohash,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isOpenCall: event.seekingPhotographers === true,
  };
}

export function clfAlbumToRecommendationItem(
  album: ClfAlbumRecSource,
): RecommendationItem {
  return {
    id: `clf:album:${album.id}`,
    source: "COMPRAMELAFOTO",
    sourceEntityId: String(album.id),
    contentType: "GALLERY",
    title: album.title,
    publicUrl: album.publicSlug ? `/a/${album.publicSlug}` : null,
    cityName: album.city,
    explicitRelatedIds: album.eventId != null ? [String(album.eventId)] : [],
  };
}
