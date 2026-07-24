import type { DnxLocation } from "../types";
import type { GeoFeedItem } from "../feed-item";

/**
 * Clickatón hoy guarda sedes como texto (sin lat/lng en schema).
 * El adaptador deja el contrato listo para cuando se agreguen coords.
 */
export type ClickatonVenueGeoSource = {
  id: string | number;
  name: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
};

export function clickatonVenueToLocation(
  venue: ClickatonVenueGeoSource,
): DnxLocation {
  const hasCoords =
    typeof venue.latitude === "number" && typeof venue.longitude === "number";
  return {
    geographicScope: hasCoords ? "LOCAL" : venue.city ? "PROVINCIAL" : "UNSPECIFIED",
    countryCode: "AR",
    countryName: venue.country || "Argentina",
    provinceName: venue.province,
    cityName: venue.city,
    placeName: venue.name,
    latitude: venue.latitude,
    longitude: venue.longitude,
  };
}

export function clickatonVenueToFeedItem(
  venue: ClickatonVenueGeoSource,
): GeoFeedItem {
  return {
    id: `clickaton-venue:${venue.id}`,
    source: "CLICKATON",
    sourceEntityId: String(venue.id),
    title: venue.name,
    publicUrl: venue.slug ? `/sedes/${venue.slug}` : null,
    geographicScope: venue.latitude != null ? "LOCAL" : "PROVINCIAL",
    countryName: venue.country || "Argentina",
    provinceName: venue.province,
    cityName: venue.city,
    placeName: venue.name,
    latitude: venue.latitude,
    longitude: venue.longitude,
  };
}
