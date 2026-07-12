import { ManualGeocodingProvider } from "./manual";
import { NominatimGeocodingProvider } from "./nominatim";
import type { GeocodingProvider } from "./types";

/**
 * Selección de proveedor.
 * - GEOCODING_PROVIDER=manual → solo manual
 * - por defecto: nominatim (sin API key; mismo patrón que CLF)
 * - MAPBOX_ACCESS_TOKEN / GOOGLE_MAPS_API_KEY reservados para etapas futuras
 */
export function getGeocodingProvider(): GeocodingProvider {
  const mode = (process.env.GEOCODING_PROVIDER || "nominatim").trim().toLowerCase();
  if (mode === "manual" || mode === "mock" || mode === "test") {
    return new ManualGeocodingProvider();
  }
  return new NominatimGeocodingProvider();
}

export type { GeocodingProvider } from "./types";
export { ManualGeocodingProvider } from "./manual";
export { NominatimGeocodingProvider } from "./nominatim";
