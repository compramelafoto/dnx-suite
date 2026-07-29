/**
 * Ranking editorial del feed — Etapa 15.
 * Delega distancia/frescura/prioridad en @repo/geo GeoRankingEngine.
 * Capas InfoSpot: exclusión, time-sensitive, featured, alcance.
 */

import { scoreGeoItem, type GeoRankable, type GeoRankingWeights } from "@repo/geo";
import { FEED_CONFIG } from "./config";
import type {
  FeedScoreBreakdown,
  FeedScoreInput,
  InfoSpotFeedItemType,
} from "./types";
import { getEventTemporalState } from "../distribution/temporal";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

function contentTypeRelevance(itemType: InfoSpotFeedItemType): number {
  return FEED_CONFIG.contentTypeRelevance[itemType] ?? 0.5;
}

/**
 * Afinidad de alcance editorial vs contexto del usuario.
 * 1 = local cercano; valores medios = provincial/nacional; bajo = sin match.
 */
export function geographicAffinityScore(input: {
  geographicScope?: string | null;
  distanceKm: number | null;
  hasOrigin: boolean;
  userProvince?: string | null;
  itemProvince?: string | null;
}): number {
  if (!input.hasOrigin) {
    // Modo nacional / sin ubicación: no sesgar por alcance.
    return 0.5;
  }

  const scope = input.geographicScope ?? null;
  const dist = input.distanceKm;

  if (scope === "LOCAL") {
    if (dist == null) return 0.45;
    if (dist <= 30) return 1;
    if (dist <= 100) return 0.85;
    return 0.35;
  }
  if (scope === "PROVINCIAL") {
    if (
      input.userProvince &&
      input.itemProvince &&
      input.userProvince.trim().toLowerCase() ===
        input.itemProvince.trim().toLowerCase()
    ) {
      return 0.8;
    }
    if (dist != null && dist <= 200) return 0.65;
    return 0.4;
  }
  if (scope === "NATIONAL") return 0.35;
  if (scope === "INTERNATIONAL") return 0.2;
  if (scope === "UNSPECIFIED") return 0.3;
  // Sin scope: coords → tratar como local; sin coords → nacional suave.
  if (dist != null && dist <= 50) return 0.9;
  if (dist != null) return 0.45;
  return 0.35;
}

function timeSensitiveBoost(input: FeedScoreInput): number {
  const cfg = FEED_CONFIG.timeSensitive;
  let score = 0;

  if (input.isExpired) return cfg.closedOrFinishedPenalty;

  if (
    input.itemType === "EVENT" ||
    input.itemType === "PHOTOGRAPHER_CALL" ||
    input.itemType === "CONTEST"
  ) {
    const temporal = getEventTemporalState({
      startAt: input.startsAt,
      endAt: input.endsAt,
      now: input.now,
    });
    if (temporal === "FINISHED" || temporal === "CANCELLED") {
      return cfg.closedOrFinishedPenalty;
    }
    if (temporal === "TODAY" || temporal === "IN_PROGRESS") {
      score += cfg.eventTodayOrInProgress;
    } else if (temporal === "UPCOMING" && input.startsAt) {
      const days = daysBetween(input.startsAt, input.now);
      if (days <= 7) score += cfg.eventUpcoming7d;
    }
  }

  if (input.itemType === "PHOTOGRAPHER_CALL") {
    score += cfg.photographerCallOpen;
  }

  return score;
}

function featuredBoost(input: FeedScoreInput): number {
  const featured = FEED_CONFIG.featured;
  if (input.isFeatured || input.editorialPriority >= featured.priorityThreshold) {
    return featured.bonus;
  }
  return 0;
}

function levelFromUnit(value: number): "Alta" | "Media" | "Baja" {
  if (value >= 0.7) return "Alta";
  if (value >= 0.35) return "Media";
  return "Baja";
}

/**
 * Score testeable del feed. `excluded=true` → no debe aparecer en resultados.
 * Usa GeoRankingEngine; no reimplementa Haversine.
 */
export function calculateInfoSpotFeedScore(
  input: FeedScoreInput,
): FeedScoreBreakdown {
  if (input.isFuturePublication) {
    return {
      total: Number.NEGATIVE_INFINITY,
      freshnessScore: 0,
      proximityScore: 0,
      editorialScore: 0,
      timeSensitiveScore: 0,
      excluded: true,
      excludeReason: "future_publication",
    };
  }

  if (input.isExpired) {
    return {
      total: Number.NEGATIVE_INFINITY,
      freshnessScore: 0,
      proximityScore: 0,
      editorialScore: 0,
      timeSensitiveScore: FEED_CONFIG.timeSensitive.closedOrFinishedPenalty,
      excluded: true,
      excludeReason: "expired",
    };
  }

  const timeSensitive = timeSensitiveBoost(input);
  if (timeSensitive <= FEED_CONFIG.timeSensitive.closedOrFinishedPenalty / 2) {
    return {
      total: Number.NEGATIVE_INFINITY,
      freshnessScore: 0,
      proximityScore: 0,
      editorialScore: 0,
      timeSensitiveScore: timeSensitive,
      excluded: true,
      excludeReason: "not_active",
    };
  }

  const weights = FEED_CONFIG.ranking.weights as GeoRankingWeights;
  const hasOrigin = input.originLatitude != null && input.originLongitude != null;

  // Distancia ya calculada aguas arriba (normalize); el motor la re-deriva si hay coords.
  // Para respetar distanceKm precalculado (centroides), inyectamos un punto sintético
  // cuando hay distanceKm pero no queremos recalcular: usamos lat/lng reales del ítem.
  const scopeAffinity = geographicAffinityScore({
    geographicScope: input.geographicScope,
    distanceKm: input.distanceKm,
    hasOrigin,
    userProvince: input.userProvince,
    itemProvince: input.itemProvince,
  });

  const rankable: GeoRankable = {
    id: input.debugId ?? "item",
    latitude: input.itemLatitude,
    longitude: input.itemLongitude,
    publishedAt: input.publishedAt,
    priority: input.editorialPriority,
    popularity: input.popularity ?? FEED_CONFIG.defaultPopularity,
    categoryMatch: contentTypeRelevance(input.itemType),
    affinity: scopeAffinity,
    statusWeight: 1,
  };

  const origin =
    hasOrigin && input.originLatitude != null && input.originLongitude != null
      ? { latitude: input.originLatitude, longitude: input.originLongitude }
      : null;

  const ranked = scoreGeoItem(rankable, origin, weights, input.now);

  // Si ya teníamos distanceKm (p.ej. centroide) y el motor no pudo (sin lat ítem),
  // re-puntuar proximidad con el distanceKm conocido.
  let distanceUnit = ranked.breakdown.distance;
  let distanceKm = ranked.distanceKm ?? input.distanceKm;
  if (
    ranked.distanceKm == null &&
    input.distanceKm != null &&
    Number.isFinite(input.distanceKm)
  ) {
    distanceKm = input.distanceKm;
    const decay = Math.max(1, weights.distanceDecayKm);
    distanceUnit = clamp(1 - input.distanceKm / decay, 0, 1);
  }

  const scale = FEED_CONFIG.ranking.scoreScale;
  const weightSum =
    weights.distance +
    weights.freshness +
    weights.priority +
    weights.popularity +
    weights.category;
  const geoTotal =
    (distanceUnit * weights.distance +
      ranked.breakdown.freshness * weights.freshness +
      ranked.breakdown.priority * weights.priority +
      ranked.breakdown.popularity * weights.popularity +
      ranked.breakdown.category * weights.category) / Math.max(1e-9, weightSum);

  const featured = featuredBoost(input);
  /** Soft boost de alcance (no altera los % documentados del motor). */
  const scopeBoost = hasOrigin ? (scopeAffinity - 0.5) * 10 : 0;
  const total = geoTotal * scale + timeSensitive + featured + scopeBoost;

  const breakdown: FeedScoreBreakdown = {
    total,
    freshnessScore: ranked.breakdown.freshness * scale,
    proximityScore: distanceUnit * scale,
    editorialScore: ranked.breakdown.priority * scale + featured,
    timeSensitiveScore: timeSensitive,
    excluded: false,
    distanceKm,
    explain: {
      distanceKm,
      distanceLevel: levelFromUnit(distanceUnit),
      freshnessLevel: levelFromUnit(ranked.breakdown.freshness),
      priorityLevel: levelFromUnit(ranked.breakdown.priority),
      popularityLevel: levelFromUnit(ranked.breakdown.popularity),
      contentTypeLevel: levelFromUnit(ranked.breakdown.category),
      finalScore: Math.round(total),
      weights: {
        distance: weights.distance,
        freshness: weights.freshness,
        priority: weights.priority,
        popularity: weights.popularity,
        category: weights.category,
      },
    },
  };

  return breakdown;
}

/** Comparador estable de desempate. */
export function compareFeedItems(
  a: {
    rankingScore: number;
    publishedAt: Date;
    distanceKm: number | null;
    editorialPriority: number;
    updatedAt: Date | null;
    id: string;
  },
  b: typeof a,
): number {
  if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
  const pubDiff = b.publishedAt.getTime() - a.publishedAt.getTime();
  if (pubDiff !== 0) return pubDiff;
  const da = a.distanceKm;
  const db = b.distanceKm;
  if (da != null && db != null && da !== db) return da - db;
  if (da != null && db == null) return -1;
  if (da == null && db != null) return 1;
  if (b.editorialPriority !== a.editorialPriority) {
    return b.editorialPriority - a.editorialPriority;
  }
  const ua = a.updatedAt?.getTime() ?? 0;
  const ub = b.updatedAt?.getTime() ?? 0;
  if (ub !== ua) return ub - ua;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
