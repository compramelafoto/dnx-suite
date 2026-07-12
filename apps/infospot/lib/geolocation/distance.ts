/**
 * Helpers de distancia / bounding box (preparación para cercanía futura).
 */

import type { Coordinates } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia Haversine en kilómetros. */
export function distanceBetweenCoordinates(
  a: Coordinates,
  b: Coordinates,
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isWithinRadius(
  origin: Coordinates,
  point: Coordinates,
  radiusKm: number,
): boolean {
  if (!(radiusKm >= 0) || !Number.isFinite(radiusKm)) return false;
  return distanceBetweenCoordinates(origin, point) <= radiusKm;
}

/** Caja aproximada en grados (suficiente para prefiltro SQL). */
export function buildBoundingBox(
  center: Coordinates,
  radiusKm: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / 111.32;
  const lngDenom = Math.max(
    0.01,
    Math.cos(toRad(center.latitude)) * 111.32,
  );
  const lngDelta = radiusKm / lngDenom;
  return {
    minLat: Math.max(-90, center.latitude - latDelta),
    maxLat: Math.min(90, center.latitude + latDelta),
    minLng: Math.max(-180, center.longitude - lngDelta),
    maxLng: Math.min(180, center.longitude + lngDelta),
  };
}
