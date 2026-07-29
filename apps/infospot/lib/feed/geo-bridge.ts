/**
 * Bridge hacia el futuro feed multiplataforma (GeoFeedItem).
 * No mezcla datos de otras apps todavía — solo adapta InfoSpot.
 */

import type { GeoFeedItem, GeoFeedSource } from "@repo/geo/feed";
import type { InfoSpotFeedItem, InfoSpotFeedItemType } from "./types";

function sourceForType(type: InfoSpotFeedItemType): GeoFeedSource {
  switch (type) {
    case "EVENT":
    case "CONTEST":
      return "INFOSPOT_EVENT";
    case "PHOTOGRAPHER_CALL":
      return "INFOSPOT_EVENT";
    default:
      return "INFOSPOT_ARTICLE";
  }
}

/**
 * Convierte un ítem del feed InfoSpot al contrato compartido GeoFeedItem.
 * Preparación Etapa 15 — sin ingestión multi-app.
 */
export function infoSpotFeedItemToGeoFeedItem(
  item: InfoSpotFeedItem,
): GeoFeedItem {
  const entityId = item.contentKey.includes(":")
    ? item.contentKey.split(":").slice(1).join(":")
    : item.id;

  return {
    id: item.id,
    source: sourceForType(item.type),
    sourceEntityId: entityId,
    title: item.title,
    excerpt: item.excerpt,
    publicUrl: item.publicUrl,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    geographicScope: (item.geographicScope as GeoFeedItem["geographicScope"]) ?? null,
    countryName: item.country,
    provinceName: item.province,
    cityName: item.city,
    latitude: item.latitude,
    longitude: item.longitude,
    priority: item.editorialPriority,
  };
}

/**
 * Punto de extensión futuro: aceptar GeoFeedItem externos y mapearlos
 * a InfoSpotFeedItem para el Home. Hoy solo tipa el contrato.
 */
export type FutureMultiAppFeedIngest = {
  items: GeoFeedItem[];
  /** Reservado — no implementar mezcla todavía. */
  enabled: false;
};
