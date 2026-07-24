/**
 * Búsqueda por cercanía — capa pura (sin SQL).
 * Las apps aplican el bounding box / geohash en sus queries Prisma.
 */

import {
  buildBoundingBox,
  distanceKm,
  isWithinRadius,
} from "../distance";
import { encodeGeohash, geohashPrefixForRadiusKm } from "../geohash";
import type { BoundingBox, Coordinates } from "../types";

export type NearbyCandidate = {
  id: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  geohash?: string | null;
};

export type NearbyQueryPlan = {
  origin: Coordinates;
  radiusKm: number;
  boundingBox: BoundingBox;
  geohashPrecision: number;
  originGeohash: string;
  geohashPrefix: string;
};

/** Plan de consulta reutilizable (prefiltro + refinamiento Haversine). */
export function planNearbyQuery(
  origin: Coordinates,
  radiusKm: number,
): NearbyQueryPlan {
  const precision = geohashPrefixForRadiusKm(radiusKm);
  const originGeohash = encodeGeohash(origin.latitude, origin.longitude, precision);
  return {
    origin,
    radiusKm,
    boundingBox: buildBoundingBox(origin, radiusKm),
    geohashPrecision: precision,
    originGeohash,
    geohashPrefix: originGeohash.slice(0, precision),
  };
}

export type NearbyMatch<T extends NearbyCandidate> = {
  item: T;
  distanceKm: number;
};

/** Filtra en memoria candidatos ya cargados (post-SQL). */
export function filterNearbyInMemory<T extends NearbyCandidate>(
  candidates: T[],
  origin: Coordinates,
  radiusKm: number,
): NearbyMatch<T>[] {
  const out: NearbyMatch<T>[] = [];
  for (const item of candidates) {
    if (
      typeof item.latitude !== "number" ||
      typeof item.longitude !== "number" ||
      (item.latitude === 0 && item.longitude === 0)
    ) {
      continue;
    }
    const point = { latitude: item.latitude, longitude: item.longitude };
    if (!isWithinRadius(origin, point, radiusKm)) continue;
    out.push({ item, distanceKm: distanceKm(origin, point) });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

/**
 * Helpers de predicado Prisma-friendly (documentación + construcción de where).
 * No ejecuta queries — evita acoplar el package a Prisma.
 */
export function boundingBoxWhere(box: BoundingBox) {
  return {
    latitude: { gte: box.minLat, lte: box.maxLat },
    longitude: { gte: box.minLng, lte: box.maxLng },
  };
}

export function geohashPrefixWhere(prefix: string) {
  return {
    geohash: { startsWith: prefix },
  };
}
