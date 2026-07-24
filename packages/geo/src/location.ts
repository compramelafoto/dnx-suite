/**
 * Contrato DnxLocation + validación por alcance geográfico.
 */

import { hasUsableCoordinates } from "./coordinates";
import {
  GEOGRAPHIC_SCOPES,
  type DnxLocation,
  type GeographicScope,
} from "./types";
import { encodeGeohash } from "./geohash";

export { GEOGRAPHIC_SCOPES };
export type { DnxLocation, GeographicScope };

export function isGeographicScope(
  value: string | null | undefined,
): value is GeographicScope {
  return Boolean(value && (GEOGRAPHIC_SCOPES as readonly string[]).includes(value));
}

export function geographicScopeLabel(
  scope: GeographicScope | null | undefined,
): string {
  switch (scope) {
    case "LOCAL":
      return "Local";
    case "PROVINCIAL":
      return "Provincial";
    case "NATIONAL":
      return "Nacional";
    case "INTERNATIONAL":
      return "Internacional";
    case "UNSPECIFIED":
      return "Sin ubicación específica";
    default:
      return "Sin definir";
  }
}

/** Errores al publicar según alcance (borrador puede estar incompleto). */
export function validateLocationForPublish(loc: DnxLocation): string[] {
  const errors: string[] = [];
  const scope = loc.geographicScope;

  if (!scope) {
    errors.push(
      "Definí el alcance geográfico (Local, Provincial, Nacional, Internacional o Sin ubicación).",
    );
    return errors;
  }

  const country = (loc.countryName || loc.countryCode || "").trim();
  const province = (loc.provinceName || "").trim();
  const city = (loc.cityName || "").trim();

  switch (scope) {
    case "LOCAL":
      if (!country) errors.push("Una ubicación local requiere país.");
      if (!province) errors.push("Una ubicación local requiere provincia.");
      if (!city) errors.push("Una ubicación local requiere ciudad.");
      if (!hasUsableCoordinates(loc.latitude, loc.longitude)) {
        errors.push(
          "Una ubicación local requiere coordenadas válidas (no se admite 0,0).",
        );
      }
      break;
    case "PROVINCIAL":
      if (!country) errors.push("Una ubicación provincial requiere país.");
      if (!province) errors.push("Una ubicación provincial requiere provincia.");
      if (
        loc.latitude != null &&
        loc.longitude != null &&
        !hasUsableCoordinates(loc.latitude, loc.longitude)
      ) {
        errors.push("Las coordenadas provinciales no son válidas (no se admite 0,0).");
      }
      break;
    case "NATIONAL":
      if (!country) errors.push("Una ubicación nacional requiere país.");
      break;
    case "INTERNATIONAL":
      if (
        loc.latitude != null &&
        loc.longitude != null &&
        !hasUsableCoordinates(loc.latitude, loc.longitude)
      ) {
        errors.push(
          "Las coordenadas internacionales no son válidas (no se admite 0,0).",
        );
      }
      break;
    case "UNSPECIFIED":
      break;
    default:
      errors.push("Alcance geográfico inválido.");
  }

  return errors;
}

/** Completa geohash si hay coords usables. */
export function withGeohash(loc: DnxLocation, precision?: number): DnxLocation {
  if (
    !hasUsableCoordinates(loc.latitude, loc.longitude) ||
    loc.latitude == null ||
    loc.longitude == null
  ) {
    return { ...loc, geohash: loc.geohash ?? null };
  }
  return {
    ...loc,
    geohash: encodeGeohash(loc.latitude, loc.longitude, precision),
  };
}
