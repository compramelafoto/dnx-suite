/**
 * Preferencias de ubicación del visitante (solo cliente / storage local).
 * No persiste GPS preciso en base de datos.
 */

import type { FeedLocationMode, LocationPermissionState } from "./types";

export const LOCATION_PREFERENCE_KEY = "infospot.location.preference.v1";
export const LOCATION_PROMPT_KEY = "infospot.location.permissionPrompt.v1";

/** Redondeo ~110 m (3 decimales) antes de persistir localmente. */
export const COORD_STORAGE_DECIMALS = 3;

export type StoredLocationPreference = {
  v: 1;
  mode: FeedLocationMode;
  permissionState: LocationPermissionState;
  latitude?: number;
  longitude?: number;
  /** Ciudad / provincia elegida manualmente (no dirección exacta). */
  city?: string;
  province?: string;
  country?: string;
  label?: string;
  updatedAt: string;
};

export type StoredPromptState = {
  v: 1;
  dismissedAt?: string;
  lastOutcome?: LocationPermissionState;
  updatedAt: string;
};

export function roundCoordinate(value: number, decimals = COORD_STORAGE_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function sanitizePreferenceForStorage(
  pref: StoredLocationPreference,
): StoredLocationPreference {
  return {
    ...pref,
    latitude:
      typeof pref.latitude === "number"
        ? roundCoordinate(pref.latitude)
        : undefined,
    longitude:
      typeof pref.longitude === "number"
        ? roundCoordinate(pref.longitude)
        : undefined,
  };
}

export function readLocationPreference(): StoredLocationPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_PREFERENCE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredLocationPreference;
    if (data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeLocationPreference(pref: StoredLocationPreference): void {
  if (typeof window === "undefined") return;
  const safe = sanitizePreferenceForStorage({
    ...pref,
    updatedAt: pref.updatedAt || new Date().toISOString(),
  });
  window.localStorage.setItem(LOCATION_PREFERENCE_KEY, JSON.stringify(safe));
}

export function clearLocationPreference(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCATION_PREFERENCE_KEY);
}

export function readPromptState(): StoredPromptState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_PROMPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPromptState;
  } catch {
    return null;
  }
}

export function writePromptState(state: StoredPromptState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCATION_PROMPT_KEY, JSON.stringify(state));
}

/** Ciudades sugeridas para selección manual (centroides AR). */
export const MANUAL_CITY_OPTIONS = [
  { city: "Buenos Aires", province: "CABA", lat: -34.604, lng: -58.382, label: "Buenos Aires (CABA)" },
  { city: "La Plata", province: "Buenos Aires", lat: -34.921, lng: -57.954, label: "La Plata" },
  { city: "Mar del Plata", province: "Buenos Aires", lat: -38.006, lng: -57.543, label: "Mar del Plata" },
  { city: "Córdoba", province: "Córdoba", lat: -31.42, lng: -64.189, label: "Córdoba" },
  { city: "Rosario", province: "Santa Fe", lat: -32.944, lng: -60.651, label: "Rosario" },
  { city: "Rafaela", province: "Santa Fe", lat: -31.25, lng: -61.487, label: "Rafaela" },
  { city: "Armstrong", province: "Santa Fe", lat: -32.914, lng: -61.92, label: "Armstrong" },
  { city: "Santa Fe", province: "Santa Fe", lat: -31.633, lng: -60.7, label: "Santa Fe" },
  { city: "Mendoza", province: "Mendoza", lat: -32.89, lng: -68.846, label: "Mendoza" },
  { city: "San Miguel de Tucumán", province: "Tucumán", lat: -26.808, lng: -65.218, label: "Tucumán" },
  { city: "Salta", province: "Salta", lat: -24.782, lng: -65.423, label: "Salta" },
  { city: "Neuquén", province: "Neuquén", lat: -38.952, lng: -68.059, label: "Neuquén" },
  { city: "Bariloche", province: "Río Negro", lat: -41.134, lng: -71.31, label: "Bariloche" },
] as const;

export function preferenceControlLabel(pref: StoredLocationPreference | null): string {
  if (!pref || pref.mode === "none" || pref.mode === "national") {
    return pref?.mode === "national" ? "Todo el país" : "Sin personalización";
  }
  if (pref.mode === "gps") return "Cerca mío";
  if (pref.label) return pref.label;
  if (pref.city) return pref.city;
  return "Ubicación manual";
}
