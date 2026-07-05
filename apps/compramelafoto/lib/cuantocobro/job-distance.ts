import { haversineDistanceMeters } from "@/lib/geo";

export function parseCoord(value: string | undefined | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function hasValidCoords(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && (lat !== 0 || lng !== 0);
}

export function computeDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const meters = haversineDistanceMeters(fromLat, fromLng, toLat, toLng);
  return Math.round((meters / 1000) * 10) / 10;
}
