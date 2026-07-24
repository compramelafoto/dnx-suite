import type { BoundingBox, Coordinates } from "./types";

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia Haversine en kilómetros. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Distancia Haversine en metros. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Alias InfoSpot geolocation. */
export const distanceBetweenCoordinates = distanceKm;

/** Alias feed InfoSpot (firma posicional). */
export function calculateDistanceKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  return distanceKm(
    { latitude: originLatitude, longitude: originLongitude },
    { latitude: destinationLatitude, longitude: destinationLongitude },
  );
}

/** Alias CLF (metros, firma posicional). */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return distanceMeters(
    { latitude: lat1, longitude: lng1 },
    { latitude: lat2, longitude: lng2 },
  );
}

export function isWithinRadius(
  origin: Coordinates,
  point: Coordinates,
  radiusKm: number,
): boolean {
  if (!(radiusKm >= 0) || !Number.isFinite(radiusKm)) return false;
  return distanceKm(origin, point) <= radiusKm;
}

/** Caja aproximada en grados (prefiltro SQL). */
export function buildBoundingBox(
  center: Coordinates,
  radiusKm: number,
): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const lngDenom = Math.max(0.01, Math.cos(toRad(center.latitude)) * 111.32);
  const lngDelta = radiusKm / lngDenom;
  return {
    minLat: Math.max(-90, center.latitude - latDelta),
    maxLat: Math.min(90, center.latitude + latDelta),
    minLng: Math.max(-180, center.longitude - lngDelta),
    maxLng: Math.min(180, center.longitude + lngDelta),
  };
}

/** Alias CLF. */
export function boundingBoxForRadiusKm(
  latitude: number,
  longitude: number,
  radiusKm: number,
): BoundingBox {
  return buildBoundingBox({ latitude, longitude }, radiusKm);
}

export function formatDistanceLabel(
  distanceKmValue: number | null | undefined,
): string | null {
  if (distanceKmValue == null || !Number.isFinite(distanceKmValue)) return null;
  if (distanceKmValue < 1) return "A menos de 1 km";
  if (distanceKmValue < 10) {
    const one = Math.round(distanceKmValue * 10) / 10;
    return `A ${one.toLocaleString("es-AR")} km`;
  }
  return `A ${Math.round(distanceKmValue).toLocaleString("es-AR")} km`;
}

export function formatLocationLabel(input: {
  city?: string | null;
  province?: string | null;
  country?: string | null;
  distanceKm?: number | null;
  national?: boolean;
}): string | null {
  const distance = formatDistanceLabel(input.distanceKm);
  if (distance) return distance;
  if (input.national) return "Contenido nacional";
  const city = input.city?.trim();
  const province = input.province?.trim();
  if (city) return `En ${city}`;
  if (province) return `En ${province}`;
  if (input.country?.trim()) return input.country.trim();
  return null;
}

/** Centroide simple de un conjunto de puntos. */
export function centroid(points: Coordinates[]): Coordinates | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / points.length, longitude: lng / points.length };
}
