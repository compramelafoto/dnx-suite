"use client";

import LocationMap from "./LocationMap";
import type { LocationMapProps } from "./LocationMap";

/**
 * Mapa de ubicación para eventos.
 * Re-exporta LocationMap para mantener compatibilidad.
 * Para direcciones de empresa / negocio usá LocationMap directamente.
 */
export default function EventLocationMap(props: LocationMapProps) {
  return <LocationMap {...props} />;
}
