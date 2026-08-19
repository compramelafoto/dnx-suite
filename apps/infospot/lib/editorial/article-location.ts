/**
 * Validación de ubicación editorial de notas (alcance + coords).
 * Motor: @repo/geo (DNX GEO ENGINE). Copy y campos province/city propios de InfoSpot.
 */

import {
  GEOGRAPHIC_SCOPES,
  geographicScopeLabel as geoScopeLabel,
  hasUsableCoordinates,
  isGeographicScope as isGeoScope,
  validateLocationForPublish,
  type GeographicScope as GeoScope,
} from "@repo/geo";

export { GEOGRAPHIC_SCOPES };
export type GeographicScope = GeoScope;

export function isGeographicScope(
  value: string | null | undefined,
): value is GeographicScope {
  return isGeoScope(value);
}

export function isValidCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return hasUsableCoordinates(latitude, longitude);
}

export type ArticleLocationInput = {
  geographicScope?: GeographicScope | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Errores al publicar según alcance. Borrador puede estar incompleto. */
export function validateArticleLocationForPublish(
  loc: ArticleLocationInput,
): string[] {
  return validateLocationForPublish({
    geographicScope: loc.geographicScope,
    countryCode: loc.countryCode,
    countryName: loc.countryName,
    provinceName: loc.province,
    cityName: loc.city,
    placeName: loc.placeName,
    address: loc.address,
    formattedAddress: loc.formattedAddress,
    latitude: loc.latitude,
    longitude: loc.longitude,
  }).map((msg) => msg.replace(/\bubicación\b/gi, "nota"));
}

export function geographicScopeLabel(
  scope: GeographicScope | null | undefined,
): string {
  return geoScopeLabel(scope);
}

/** Resumen de una línea para el estado cerrado del panel lateral (formulario, valores string). */
export function articleLocationSummary(value: {
  geographicScope: GeographicScope | "";
  city: string;
  province: string;
  placeName: string;
}): string {
  if (!value.geographicScope) return "Sin definir";
  if (value.geographicScope === "UNSPECIFIED") return "Sin ubicación específica";
  const parts = [value.city, value.province].filter((p) => p && p.trim());
  if (parts.length > 0) return parts.join(", ");
  if (value.placeName) return value.placeName;
  return geographicScopeLabel(value.geographicScope);
}
