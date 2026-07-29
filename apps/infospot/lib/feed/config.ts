/**
 * Pesos y rangos centralizados del feed unificado (ETAPA 11 + 15).
 * No dispersar números mágicos en otros archivos.
 *
 * Ranking editorial (Etapa 15) — porcentajes sobre GeoRankingEngine:
 *   cercanía 40% · actualidad 25% · prioridad 15% · popularidad 10% · tipo 10%
 */

import type { GeoRankingWeights } from "@repo/geo";

export const FEED_CONFIG = {
  /** Candidatos máximos por fuente antes de rankear. */
  candidateLimit: {
    articles: 80,
    events: 80,
    /** Extra locales cuando hay GPS/manual (bbox). */
    nearbyArticles: 40,
    nearbyEvents: 40,
  },
  /** Página por defecto / máximo. */
  page: {
    defaultLimit: 12,
    maxLimit: 30,
  },
  /** Ventana de artículos por publishedAt (días). */
  articleLookbackDays: 90,
  /** Radio por defecto para bloques “cerca” y soft-hint del feed. */
  defaultRadiusKm: 100,
  /** Radio máximo aceptado en API. */
  maxRadiusKm: 300,
  /** Diversidad: máximo de ítems consecutivos del mismo tipo. */
  diversity: {
    maxConsecutiveSameType: 3,
    /** Solo reordenar si la diferencia de score es ≤ este umbral. */
    maxScoreDelta: 12,
  },
  /**
   * Pesos del GeoRankingEngine (deben sumar ~1.0 en las claves usadas).
   * Modificar aquí — no hardcodear en score.ts.
   */
  ranking: {
    weights: {
      distance: 0.4,
      freshness: 0.25,
      priority: 0.15,
      popularity: 0.1,
      /** Tipo de contenido (NEWS/EVENT/CALL/…). */
      category: 0.1,
      /** Alcance geográfico vs usuario (local/provincial/nacional). */
      affinity: 0,
      status: 0,
      distanceDecayKm: 120,
      missingCoordsScore: 0.28,
    } satisfies GeoRankingWeights,
    /** Escala 0–1 del motor → puntos de ranking del feed. */
    scoreScale: 100,
    /**
     * Soft-filter: fuera de radio, el ítem sigue en el feed nacional
     * pero no en bloques “cerca”. El ranking usa decay continuo.
     */
    applyHardRadiusFilter: false,
  },
  /** Prioridad editorial: techo y decaimiento del bonus legacy (compat). */
  editorial: {
    maxBonus: 25,
    decayAfterDays: 14,
    decayFactor: 0.45,
  },
  /** Buckets legacy (solo referencia / tests de migración). Preferir ranking.weights. */
  freshness: {
    under24h: 50,
    days1to3: 38,
    days4to7: 26,
    days8to30: 14,
    over30Days: 4,
    upcomingEventFloor: 18,
  },
  proximity: {
    under10km: 40,
    km10to30: 28,
    km30to100: 16,
    km100to300: 6,
    over300km: 0,
    missingCoords: 8,
  },
  timeSensitive: {
    eventTodayOrInProgress: 12,
    eventUpcoming7d: 8,
    photographerCallOpen: 10,
    closedOrFinishedPenalty: -80,
  },
  featured: {
    priorityThreshold: 50,
    bonus: 6,
  },
  /** Relevancia base por tipo (0–1) → weight `category` del motor. */
  contentTypeRelevance: {
    PHOTOGRAPHER_CALL: 1,
    EVENT: 0.92,
    COVERAGE: 0.88,
    NEWS: 0.82,
    CONTEST: 0.78,
    CHRONICLE: 0.75,
    INTERVIEW: 0.72,
    GUIDE: 0.65,
    INSTITUTIONAL: 0.45,
    OTHER: 0.5,
  },
  /** Popularidad neutra mientras no haya métricas en el pipeline del feed. */
  defaultPopularity: 0.4,
} as const;

export type FeedConfig = typeof FEED_CONFIG;
