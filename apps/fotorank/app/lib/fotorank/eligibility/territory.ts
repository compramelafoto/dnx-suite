import type { EligibilityResult, TerritoryStatus } from "./types";
import { SANTA_FE_APPROX_BOUNDS } from "./types";

export function evaluateTerritoryEligibility(input: {
  territoryConfirmedSantaFe: boolean;
  captureLocality: string | null | undefined;
  captureDepartment?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
}): EligibilityResult & { territoryStatus: TerritoryStatus } {
  const locality = (input.captureLocality ?? "").trim();
  if (!input.territoryConfirmedSantaFe) {
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "TERRITORY_CONFIRMATION_MISSING",
      publicMessage: "Debés confirmar que la fotografía fue tomada en la Provincia de Santa Fe.",
      internalMessage: "territoryConfirmedSantaFe=false",
      evidence: {},
      territoryStatus: "TERRITORY_REJECTED",
    };
  }
  if (!locality) {
    return {
      decision: "NOT_ELIGIBLE",
      reasonCode: "TERRITORY_LOCALITY_MISSING",
      publicMessage: "Indicá la localidad o paraje donde fue tomada la fotografía.",
      internalMessage: "captureLocality empty",
      evidence: {},
      territoryStatus: "TERRITORY_REJECTED",
    };
  }

  const lat = input.gpsLatitude;
  const lng = input.gpsLongitude;
  const hasGps = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);

  if (!hasGps) {
    return {
      decision: "DECLARED_VALID",
      reasonCode: "TERRITORY_DECLARED_VALID",
      publicMessage: "Declaración territorial recibida. El GPS no es obligatorio.",
      internalMessage: "declaration only",
      evidence: {
        locality,
        department: input.captureDepartment ?? null,
        gpsPresent: false,
      },
      territoryStatus: "TERRITORY_CONFIRMED_BY_DECLARATION",
    };
  }

  const inside =
    lat! >= SANTA_FE_APPROX_BOUNDS.latMin &&
    lat! <= SANTA_FE_APPROX_BOUNDS.latMax &&
    lng! >= SANTA_FE_APPROX_BOUNDS.lngMin &&
    lng! <= SANTA_FE_APPROX_BOUNDS.lngMax;

  if (inside) {
    return {
      decision: "GPS_SUPPORTED",
      reasonCode: "TERRITORY_GPS_SUPPORTED",
      publicMessage: "La declaración territorial es coherente con la evidencia disponible.",
      internalMessage: "gps approx inside santa fe bbox",
      evidence: { locality, gpsPresent: true, gpsApproxInside: true },
      territoryStatus: "TERRITORY_SUPPORTED_BY_GPS",
    };
  }

  return {
    decision: "REVIEW_REQUIRED",
    reasonCode: "TERRITORY_GPS_REVIEW",
    publicMessage:
      "Hay una posible inconsistencia territorial. La organización revisará la obra. El GPS exacto no se publica.",
    internalMessage: "gps approx outside santa fe bbox",
    evidence: { locality, gpsPresent: true, gpsApproxInside: false },
    territoryStatus: "TERRITORY_REVIEW_REQUIRED",
  };
}

/** Nunca incluir coordenadas en DTOs públicos. */
export function publicTerritoryView(input: {
  captureLocality: string;
  captureDepartment?: string | null;
  territoryStatus: TerritoryStatus;
  gpsPresent: boolean;
}) {
  return {
    captureLocality: input.captureLocality,
    captureDepartment: input.captureDepartment ?? null,
    territoryStatus: input.territoryStatus,
    gpsPresent: input.gpsPresent,
  };
}
