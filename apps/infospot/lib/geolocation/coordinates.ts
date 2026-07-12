/**
 * Validación de coordenadas geográficas.
 */

import type { Coordinates } from "./types";

export type CoordinateValidation =
  | { ok: true; coordinates: Coordinates }
  | { ok: false; reason: string };

/** True si lat/lng son números finitos en rango y no son el placeholder 0,0. */
export function validateCoordinates(
  latitude: unknown,
  longitude: unknown,
): CoordinateValidation {
  const lat =
    typeof latitude === "string" ? Number(latitude.trim()) : Number(latitude);
  const lng =
    typeof longitude === "string" ? Number(longitude.trim()) : Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "Coordenadas no numéricas." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, reason: "Latitud fuera de rango (−90…90)." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, reason: "Longitud fuera de rango (−180…180)." };
  }
  if (lat === 0 && lng === 0) {
    return { ok: false, reason: "Coordenadas 0,0 no son válidas." };
  }
  return { ok: true, coordinates: { latitude: lat, longitude: lng } };
}

export function hasUsableEventCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return validateCoordinates(latitude, longitude).ok;
}
