/**
 * Contratos del DNX Recommendation Engine (sin Prisma/React/Next).
 */

export const RECOMMENDATION_CONTENT_TYPES = [
  "NEWS",
  "EVENT",
  "PHOTOGRAPHER_CALL",
  "COVERAGE",
  "GALLERY",
  "CONTEST",
  "COURSE",
  "SPONSOR",
  "OTHER",
] as const;

export type RecommendationContentType =
  (typeof RECOMMENDATION_CONTENT_TYPES)[number];

export const RECOMMENDATION_SOURCES = [
  "INFOSPOT",
  "COMPRAMELAFOTO",
  "CLICKATON",
  "FOTORANK",
  "FOTOFFICE",
  "SPONSOR",
  "OTHER",
] as const;

export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number];

/**
 * Ítem genérico recomendable (multi-app).
 * Compatible conceptualmente con GeoFeedItem; no lo reemplaza.
 */
export type RecommendationItem = {
  id: string;
  source: RecommendationSource;
  sourceEntityId: string;
  contentType: RecommendationContentType;
  title: string;
  excerpt?: string | null;
  publicUrl?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  tags?: string[];
  publishedAt?: Date | string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  provinceName?: string | null;
  cityName?: string | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  /** 0–100 */
  priority?: number | null;
  /** 0–1 */
  popularity?: number | null;
  /** IDs de entidades relacionadas explícitamente. */
  explicitRelatedIds?: string[];
  /** Convocatoria abierta. */
  isOpenCall?: boolean;
  /** Evento/actividad ya finalizada. */
  isFinished?: boolean;
  meta?: Record<string, unknown>;
};

/**
 * Contexto opcional — hoy seed + geo; mañana intereses/historial.
 */
export type RecommendationContext = {
  /** Ítem ancla (p.ej. nota actual). Se excluye siempre. */
  seed?: RecommendationItem | null;
  /** IDs a excluir (incluye seed). */
  excludeIds?: string[];
  /** Ciudad / provincia / GPS del usuario (personalización futura). */
  userCity?: string | null;
  userProvince?: string | null;
  userLatitude?: number | null;
  userLongitude?: number | null;
  interestCategoryIds?: string[];
  interestTags?: string[];
  favoriteCategories?: string[];
  historyItemIds?: string[];
  now?: Date;
  limit?: number;
  excludedTypes?: RecommendationContentType[];
  radiusKm?: number | null;
  /**
   * Bloque semántico — filtra/prioriza sin romper el score base.
   * similar | nearby | upcoming_events | open_calls | coverages
   */
  block?:
    | "similar"
    | "nearby"
    | "upcoming_events"
    | "open_calls"
    | "coverages"
    | "all";
};

export type RecommendationExplainFactor = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  contribution: number;
};

export type RecommendationExplain = {
  factors: RecommendationExplainFactor[];
  finalScore: number;
  distanceKm: number | null;
  summaryLines: string[];
};

export type RankedRecommendation = {
  item: RecommendationItem;
  score: number;
  distanceKm: number | null;
  explain: RecommendationExplain;
};

export type RecommendationEngineOptions = {
  weights?: Partial<typeof import("./config").RECOMMENDATION_WEIGHTS>;
  thresholds?: Partial<typeof import("./config").RECOMMENDATION_THRESHOLDS>;
  limits?: Partial<typeof import("./config").RECOMMENDATION_LIMITS>;
  boosts?: Partial<typeof import("./config").RECOMMENDATION_BOOSTS>;
  penalties?: Partial<typeof import("./config").RECOMMENDATION_PENALTIES>;
};
