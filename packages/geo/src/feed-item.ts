/**
 * Contrato preparado para un feed unificado futuro (Etapa 15+).
 * No implementa agregación cross-app todavía.
 */

import type { GeographicScope } from "./types";

export const GEO_FEED_SOURCES = [
  "INFOSPOT_ARTICLE",
  "INFOSPOT_EVENT",
  "CLF_EVENT",
  "CLF_ALBUM",
  "CLICKATON",
  "FOTORANK",
  "FOTOFFICE",
  "COURSE",
  "SPONSOR",
  "GALLERY",
  "OTHER",
] as const;

export type GeoFeedSource = (typeof GEO_FEED_SOURCES)[number];

/**
 * Ítem genérico georreferenciable para un feed multi-app.
 * Cada adaptador proyecta su entidad a este shape.
 */
export type GeoFeedItem = {
  id: string;
  source: GeoFeedSource;
  sourceEntityId: string;
  title: string;
  excerpt?: string | null;
  publicUrl?: string | null;
  imageUrl?: string | null;
  publishedAt?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  geographicScope?: GeographicScope | null;
  countryCode?: string | null;
  countryName?: string | null;
  provinceName?: string | null;
  cityName?: string | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  priority?: number | null;
  tags?: string[];
  meta?: Record<string, unknown>;
};

export type GeoFeedAdapter<TRaw> = {
  source: GeoFeedSource;
  toFeedItem(raw: TRaw): GeoFeedItem | null;
};
