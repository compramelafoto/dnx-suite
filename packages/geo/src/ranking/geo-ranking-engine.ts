/**
 * Motor de ranking geográfico genérico.
 * Cada app define pesos; no hardcodea reglas editoriales.
 */

import { distanceKm } from "../distance";
import type { Coordinates } from "../types";

export type GeoRankable = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Epoch ms o Date — frescura. */
  publishedAt?: Date | number | null;
  /** 0–100 prioridad editorial/negocio. */
  priority?: number | null;
  /** 0–1 popularidad normalizada. */
  popularity?: number | null;
  /** Multiplicador de estado (p.ej. abierto=1, cerrado=0). */
  statusWeight?: number | null;
  /** 0–1 afinidad (categoría, intereses). */
  affinity?: number | null;
  /** 0–1 match de categoría. */
  categoryMatch?: number | null;
};

export type GeoRankingWeights = {
  distance: number;
  freshness: number;
  priority: number;
  popularity: number;
  status: number;
  affinity: number;
  category: number;
  /** Distancia a la que el score de cercanía cae a ~0 (km). */
  distanceDecayKm: number;
  /** Bonus cuando faltan coords (contenido nacional / sin geo). */
  missingCoordsScore: number;
};

export const DEFAULT_GEO_RANKING_WEIGHTS: GeoRankingWeights = {
  distance: 0.35,
  freshness: 0.25,
  priority: 0.15,
  popularity: 0.1,
  status: 0.05,
  affinity: 0.05,
  category: 0.05,
  distanceDecayKm: 80,
  missingCoordsScore: 0.35,
};

export type GeoRankedItem<T extends GeoRankable = GeoRankable> = {
  item: T;
  score: number;
  distanceKm: number | null;
  breakdown: {
    distance: number;
    freshness: number;
    priority: number;
    popularity: number;
    status: number;
    affinity: number;
    category: number;
  };
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function freshnessScore(publishedAt: Date | number | null | undefined, now: Date): number {
  if (publishedAt == null) return 0.4;
  const t = publishedAt instanceof Date ? publishedAt.getTime() : Number(publishedAt);
  if (!Number.isFinite(t)) return 0.4;
  const ageHours = Math.max(0, (now.getTime() - t) / (1000 * 60 * 60));
  // ~1 a 0h, ~0.2 a 14 días
  return clamp01(Math.exp(-ageHours / (14 * 24)));
}

function proximityScore(
  distance: number | null,
  decayKm: number,
  missingScore: number,
): number {
  if (distance == null || !Number.isFinite(distance)) return missingScore;
  if (distance <= 0) return 1;
  return clamp01(1 - distance / Math.max(1, decayKm));
}

export function scoreGeoItem<T extends GeoRankable>(
  item: T,
  origin: Coordinates | null,
  weights: Partial<GeoRankingWeights> = {},
  now: Date = new Date(),
): GeoRankedItem<T> {
  const w = { ...DEFAULT_GEO_RANKING_WEIGHTS, ...weights };
  const weightSum =
    w.distance +
    w.freshness +
    w.priority +
    w.popularity +
    w.status +
    w.affinity +
    w.category;

  let dist: number | null = null;
  if (
    origin &&
    typeof item.latitude === "number" &&
    typeof item.longitude === "number" &&
    !(item.latitude === 0 && item.longitude === 0)
  ) {
    dist = distanceKm(origin, {
      latitude: item.latitude,
      longitude: item.longitude,
    });
  }

  const breakdown = {
    distance: proximityScore(dist, w.distanceDecayKm, w.missingCoordsScore),
    freshness: freshnessScore(item.publishedAt, now),
    priority: clamp01((item.priority ?? 0) / 100),
    popularity: clamp01(item.popularity ?? 0),
    status: clamp01(item.statusWeight ?? 1),
    affinity: clamp01(item.affinity ?? 0),
    category: clamp01(item.categoryMatch ?? 0),
  };

  const raw =
    breakdown.distance * w.distance +
    breakdown.freshness * w.freshness +
    breakdown.priority * w.priority +
    breakdown.popularity * w.popularity +
    breakdown.status * w.status +
    breakdown.affinity * w.affinity +
    breakdown.category * w.category;

  const score = weightSum > 0 ? raw / weightSum : 0;

  return { item, score, distanceKm: dist, breakdown };
}

export function rankGeoItems<T extends GeoRankable>(
  items: T[],
  origin: Coordinates | null,
  weights?: Partial<GeoRankingWeights>,
  now?: Date,
): GeoRankedItem<T>[] {
  return items
    .map((item) => scoreGeoItem(item, origin, weights, now))
    .sort((a, b) => b.score - a.score || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}

/** Alias documentado. */
export const GeoRankingEngine = {
  score: scoreGeoItem,
  rank: rankGeoItems,
  defaultWeights: DEFAULT_GEO_RANKING_WEIGHTS,
};
