/**
 * Contrato normalizado del feed unificado Info Spot (ViewModel de lectura).
 */

export const INFO_SPOT_FEED_ITEM_TYPES = [
  "NEWS",
  "EVENT",
  "PHOTOGRAPHER_CALL",
  "COVERAGE",
  "INTERVIEW",
  "CHRONICLE",
  "CONTEST",
  "GUIDE",
  "INSTITUTIONAL",
  "OTHER",
] as const;

export type InfoSpotFeedItemType = (typeof INFO_SPOT_FEED_ITEM_TYPES)[number];

export const FEED_TYPE_LABELS: Record<InfoSpotFeedItemType, string> = {
  NEWS: "Noticia",
  EVENT: "Evento",
  PHOTOGRAPHER_CALL: "Convocatoria",
  COVERAGE: "Cobertura",
  INTERVIEW: "Entrevista",
  CHRONICLE: "Crónica",
  CONTEST: "Concurso",
  GUIDE: "Guía",
  INSTITUTIONAL: "Institucional",
  OTHER: "Artículo",
};

export const LOCATION_PERMISSION_STATES = [
  "idle",
  "requesting",
  "granted",
  "denied",
  "unavailable",
  "timeout",
  "manual",
  "approximate",
] as const;

export type LocationPermissionState = (typeof LOCATION_PERMISSION_STATES)[number];

export type FeedLocationMode = "none" | "gps" | "manual" | "national";

export type FeedScoreExplain = {
  distanceKm: number | null;
  distanceLevel: "Alta" | "Media" | "Baja";
  freshnessLevel: "Alta" | "Media" | "Baja";
  priorityLevel: "Alta" | "Media" | "Baja";
  popularityLevel: "Alta" | "Media" | "Baja";
  contentTypeLevel: "Alta" | "Media" | "Baja";
  finalScore: number;
  weights: {
    distance: number;
    freshness: number;
    priority: number;
    popularity: number;
    category: number;
  };
};

export type InfoSpotFeedItem = {
  id: string;
  type: InfoSpotFeedItemType;
  typeLabel: string;
  title: string;
  excerpt: string | null;
  slug: string;
  publicUrl: string;
  imageUrl: string | null;

  publishedAt: Date;
  updatedAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;

  latitude: number | null;
  longitude: number | null;
  city: string | null;
  province: string | null;
  country: string | null;

  isFeatured: boolean;
  editorialPriority: number;
  isTimeSensitive: boolean;

  statusLabel: string | null;
  locationLabel: string | null;
  distanceKm: number | null;
  distanceLabel: string | null;
  rankingScore: number;

  /** Alcance editorial (Etapa 13) — útil para métricas y bridge GeoFeedItem. */
  geographicScope?: string | null;

  /** Explicabilidad interna (solo desarrollo). */
  rankingExplain?: FeedScoreExplain | null;

  /** Clave estable para exclusión / dedupe (article:id | event:id). */
  contentKey: string;
};

/** Versión serializable para RSC / JSON. */
export type InfoSpotFeedItemDto = Omit<
  InfoSpotFeedItem,
  "publishedAt" | "updatedAt" | "startsAt" | "endsAt"
> & {
  publishedAt: string;
  updatedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type FeedOrigin = {
  latitude: number;
  longitude: number;
  mode: Exclude<FeedLocationMode, "none" | "national">;
  label?: string | null;
  province?: string | null;
  city?: string | null;
};

export type GetPublicFeedInput = {
  lat?: number | null;
  lng?: number | null;
  cursor?: string | null;
  limit?: number;
  types?: InfoSpotFeedItemType[];
  radiusKm?: number | null;
  locationMode?: FeedLocationMode;
  excludeContentKeys?: string[];
  now?: Date;
  /** Provincia del usuario (modo manual) para afinidad provincial. */
  userProvince?: string | null;
  /** Incluir métricas de generación (dev). */
  includeMetrics?: boolean;
};

export type GetPublicFeedResult = {
  items: InfoSpotFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  locationMode: FeedLocationMode;
  personalized: boolean;
  metrics?: FeedGenerationMetrics;
};

export type FeedScoreInput = {
  publishedAt: Date;
  distanceKm: number | null;
  isFeatured: boolean;
  editorialPriority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  itemType: InfoSpotFeedItemType;
  now: Date;
  /** Evento/convocatoria ya no vigente. */
  isExpired?: boolean;
  /** Noticia con publishedAt futuro. */
  isFuturePublication?: boolean;
  /** Origen del visitante (GPS/manual). */
  originLatitude?: number | null;
  originLongitude?: number | null;
  /** Coords del ítem (para GeoRankingEngine). */
  itemLatitude?: number | null;
  itemLongitude?: number | null;
  geographicScope?: string | null;
  userProvince?: string | null;
  itemProvince?: string | null;
  popularity?: number | null;
  debugId?: string;
};

export type FeedScoreBreakdown = {
  total: number;
  freshnessScore: number;
  proximityScore: number;
  editorialScore: number;
  timeSensitiveScore: number;
  excluded: boolean;
  excludeReason?: string;
  distanceKm?: number | null;
  /** Solo para debugging / desarrollo — no mostrar al usuario final. */
  explain?: FeedScoreExplain;
};

export type FeedGenerationMetrics = {
  generatedAt: string;
  durationMs: number;
  candidatesLoaded: number;
  distanceCalculations: number;
  itemsRanked: number;
  pageSize: number;
  locationMode: FeedLocationMode;
  personalized: boolean;
  scopeCounts: {
    local: number;
    provincial: number;
    national: number;
    international: number;
    unspecified: number;
    unknown: number;
  };
  averageDistanceKm: number | null;
};
