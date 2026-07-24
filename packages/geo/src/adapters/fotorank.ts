import type { DnxLocation } from "../types";
import type { GeoFeedItem } from "../feed-item";

/**
 * FotoRank aún no tiene georreferencia de producto.
 * Adaptador stub para integración futura (concursos / organizaciones).
 */
export type FotoRankGeoSource = {
  id: string | number;
  title: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  publicPath?: string | null;
};

export function fotorankToLocation(entity: FotoRankGeoSource): DnxLocation {
  return {
    geographicScope:
      entity.latitude != null && entity.longitude != null
        ? "LOCAL"
        : entity.city
          ? "PROVINCIAL"
          : "UNSPECIFIED",
    countryName: entity.country,
    provinceName: entity.province,
    cityName: entity.city,
    latitude: entity.latitude,
    longitude: entity.longitude,
  };
}

export function fotorankToFeedItem(entity: FotoRankGeoSource): GeoFeedItem {
  return {
    id: `fotorank:${entity.id}`,
    source: "FOTORANK",
    sourceEntityId: String(entity.id),
    title: entity.title,
    publicUrl: entity.publicPath ?? null,
    cityName: entity.city,
    provinceName: entity.province,
    countryName: entity.country,
    latitude: entity.latitude,
    longitude: entity.longitude,
  };
}
