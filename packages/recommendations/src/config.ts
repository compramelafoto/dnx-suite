/**
 * Configuración central del DNX Recommendation Engine.
 * No hardcodear pesos en score.ts / engine.ts.
 */

import type { RecommendationContentType } from "./types";

export const RECOMMENDATION_WEIGHTS = {
  category: 0.22,
  tags: 0.12,
  geo: 0.22,
  freshness: 0.14,
  priority: 0.1,
  contentType: 0.08,
  popularity: 0.06,
  temporal: 0.04,
  explicitRelation: 0.02,
} as const;

export const RECOMMENDATION_THRESHOLDS = {
  /** Score mínimo (0–100) para incluir en resultados. */
  minScore: 12,
  /** Decay de distancia (km) — alineado a uso de @repo/geo. */
  distanceDecayKm: 100,
  missingCoordsScore: 0.25,
  /** Días para decay de frescura. */
  freshnessHalfLifeDays: 14,
  /** Ventana temporal para “próximas actividades” (días). */
  upcomingWindowDays: 45,
  /** Similitud de tags (Jaccard) mínima para boost. */
  tagOverlapUseful: 0.15,
} as const;

export const RECOMMENDATION_LIMITS = {
  default: 6,
  max: 20,
  similar: 6,
  nearby: 6,
  upcoming: 6,
  openCalls: 6,
  coverages: 6,
} as const;

/** Boosts / penalties configurables (puntos 0–100 tras normalizar). */
export const RECOMMENDATION_BOOSTS = {
  sameCategory: 8,
  sameCity: 6,
  sameProvince: 3,
  openCall: 5,
  explicitRelated: 12,
  coverageType: 4,
} as const;

export const RECOMMENDATION_PENALTIES = {
  selfItem: 10_000,
  excludedType: 10_000,
  finishedEvent: 40,
  closedCall: 50,
  historySeen: 6,
} as const;

/** Afinidad base por tipo de contenido respecto a un seed. */
export const CONTENT_TYPE_AFFINITY: Record<
  RecommendationContentType,
  Partial<Record<RecommendationContentType, number>>
> = {
  NEWS: {
    NEWS: 1,
    COVERAGE: 0.85,
    EVENT: 0.55,
    PHOTOGRAPHER_CALL: 0.4,
    GALLERY: 0.5,
    OTHER: 0.3,
  },
  COVERAGE: {
    COVERAGE: 1,
    NEWS: 0.8,
    GALLERY: 0.9,
    EVENT: 0.6,
    PHOTOGRAPHER_CALL: 0.45,
  },
  EVENT: {
    EVENT: 1,
    PHOTOGRAPHER_CALL: 0.85,
    NEWS: 0.5,
    COVERAGE: 0.55,
    CONTEST: 0.7,
  },
  PHOTOGRAPHER_CALL: {
    PHOTOGRAPHER_CALL: 1,
    EVENT: 0.9,
    COVERAGE: 0.5,
    NEWS: 0.35,
  },
  GALLERY: { GALLERY: 1, COVERAGE: 0.9, NEWS: 0.5 },
  CONTEST: { CONTEST: 1, EVENT: 0.7, NEWS: 0.4 },
  COURSE: { COURSE: 1, EVENT: 0.5, OTHER: 0.4 },
  SPONSOR: { SPONSOR: 1, EVENT: 0.4, OTHER: 0.3 },
  OTHER: { OTHER: 0.5, NEWS: 0.4 },
};

export const DEFAULT_EXCLUDED_TYPES: RecommendationContentType[] = [];
