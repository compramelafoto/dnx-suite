/**
 * Utilidades geográficas para álbumes colaborativos y eventos.
 * Motor: @repo/geo (DNX GEO ENGINE). Se mantiene la API histórica de CLF
 * (default geohash precision 8; bbox {south,west,north,east}).
 */

import {
  encodeGeohash as encodeGeohashCore,
  geohashPrefixForRadiusKm as geohashPrefixForRadiusKmCore,
  haversineDistanceMeters as haversineDistanceMetersCore,
  boundingBoxForRadiusKm as boundingBoxCore,
} from "@repo/geo";

/**
 * Codifica lat/lng en geohash.
 * Default CLF: precision 8 ≈ ±38 m (históricamente distinto del 7 de InfoSpot).
 */
export function encodeGeohash(lat: number, lng: number, precision = 8): string {
  return encodeGeohashCore(lat, lng, precision);
}

export function geohashPrefixForRadiusKm(radiusKm: number): number {
  return geohashPrefixForRadiusKmCore(radiusKm);
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineDistanceMetersCore(lat1, lng1, lat2, lng2);
}

/** Caja aproximada (WGS84) — shape histórico CLF. */
export function boundingBoxForRadiusKm(
  lat: number,
  lng: number,
  radiusKm: number,
): { south: number; west: number; north: number; east: number } {
  const box = boundingBoxCore(lat, lng, radiusKm);
  return {
    south: box.minLat,
    north: box.maxLat,
    west: box.minLng,
    east: box.maxLng,
  };
}

/**
 * Diferencia absoluta en horas entre dos fechas.
 */
export function hoursDiff(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60));
}
