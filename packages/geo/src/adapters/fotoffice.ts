import type { DnxLocation } from "../types";
import type { GeoFeedItem } from "../feed-item";

/**
 * FotoOffice / estudios — stub listo para sedes físicas futuras.
 */
export type FotoOfficeGeoSource = {
  id: string | number;
  name: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function fotofficeToLocation(entity: FotoOfficeGeoSource): DnxLocation {
  return {
    geographicScope:
      entity.latitude != null && entity.longitude != null
        ? "LOCAL"
        : entity.city
          ? "PROVINCIAL"
          : "UNSPECIFIED",
    countryName: entity.country || "Argentina",
    provinceName: entity.province,
    cityName: entity.city,
    placeName: entity.name,
    address: entity.address,
    latitude: entity.latitude,
    longitude: entity.longitude,
  };
}

export function fotofficeToFeedItem(entity: FotoOfficeGeoSource): GeoFeedItem {
  return {
    id: `fotoffice:${entity.id}`,
    source: "FOTOFFICE",
    sourceEntityId: String(entity.id),
    title: entity.name,
    cityName: entity.city,
    provinceName: entity.province,
    countryName: entity.country,
    placeName: entity.name,
    latitude: entity.latitude,
    longitude: entity.longitude,
  };
}
