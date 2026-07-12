/**
 * Reglas de publicación y readiness geográfica.
 */

import { hasUsableEventCoordinates } from "./coordinates";
import type { EventLocationFields, GeocodingStatus } from "./types";

export type LocationReadiness = {
  ready: boolean;
  reasons: string[];
  status: GeocodingStatus | "UNKNOWN";
};

/** Checklist mínimo para PUBLISHED (y APPROVE hacia ready-to-publish). */
export function isEventLocationPublishReady(
  event: EventLocationFields,
): LocationReadiness {
  const reasons: string[] = [];
  const status = (event.geocodingStatus || "PENDING") as GeocodingStatus;

  if (!event.city?.trim()) reasons.push("Falta ciudad");
  if (!event.province?.trim()) reasons.push("Falta provincia o región");
  if (!hasUsableEventCoordinates(event.latitude, event.longitude)) {
    reasons.push("Faltan coordenadas válidas");
  }
  if (!event.locationConfirmedAt) {
    reasons.push("Ubicación no confirmada");
  }
  if (status === "FAILED") {
    reasons.push("Geocodificación fallida");
  }
  if (status === "NEEDS_REVIEW" && !event.locationConfirmedAt) {
    reasons.push("Ubicación requiere revisión");
  }

  return {
    ready: reasons.length === 0,
    reasons,
    status,
  };
}

/** Suficiente para outbound CLF (coords + ciudad + confirmación). */
export function isEventLocationProvisionReady(
  event: EventLocationFields,
): LocationReadiness {
  return isEventLocationPublishReady(event);
}

export function geocodingStatusLabel(status: GeocodingStatus | null | undefined): string {
  switch (status) {
    case "CONFIRMED":
      return "Ubicación confirmada";
    case "GEOCODED":
      return "Ubicación encontrada";
    case "NEEDS_REVIEW":
      return "Requiere revisión";
    case "FAILED":
      return "Error de geocodificación";
    case "PENDING":
      return "Geocodificación pendiente";
    default:
      return "Sin ubicación";
  }
}
