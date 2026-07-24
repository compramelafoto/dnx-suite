import type { DnxLocation } from "../types";
import type { GeoFeedItem } from "../feed-item";
import { withGeohash } from "../location";

export type ClfEventGeoSource = {
  id: number | string;
  title: string;
  shareSlug?: string | null;
  city?: string | null;
  locationName?: string | null;
  latitude: number;
  longitude: number;
  coverImageKey?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export type ClfAlbumGeoSource = {
  id: number | string;
  title: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
};

export function clfEventToLocation(event: ClfEventGeoSource): DnxLocation {
  return withGeohash({
    geographicScope: "LOCAL",
    countryCode: "AR",
    countryName: "Argentina",
    cityName: event.city,
    placeName: event.locationName,
    latitude: event.latitude,
    longitude: event.longitude,
  });
}

export function clfAlbumToLocation(album: ClfAlbumGeoSource): DnxLocation {
  return withGeohash({
    geographicScope:
      album.latitude != null && album.longitude != null ? "LOCAL" : "UNSPECIFIED",
    countryCode: "AR",
    countryName: "Argentina",
    cityName: album.city,
    latitude: album.latitude,
    longitude: album.longitude,
    geohash: album.geohash,
  });
}

export function clfEventToFeedItem(event: ClfEventGeoSource): GeoFeedItem {
  return {
    id: `clf-event:${event.id}`,
    source: "CLF_EVENT",
    sourceEntityId: String(event.id),
    title: event.title,
    publicUrl: event.shareSlug ? `/e/${event.shareSlug}` : null,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    geographicScope: "LOCAL",
    countryCode: "AR",
    countryName: "Argentina",
    cityName: event.city,
    placeName: event.locationName,
    latitude: event.latitude,
    longitude: event.longitude,
  };
}

export function clfAlbumToFeedItem(album: ClfAlbumGeoSource): GeoFeedItem {
  return {
    id: `clf-album:${album.id}`,
    source: "CLF_ALBUM",
    sourceEntityId: String(album.id),
    title: album.title,
    geographicScope:
      album.latitude != null && album.longitude != null ? "LOCAL" : "UNSPECIFIED",
    countryCode: "AR",
    cityName: album.city,
    latitude: album.latitude,
    longitude: album.longitude,
    geohash: album.geohash,
  };
}
