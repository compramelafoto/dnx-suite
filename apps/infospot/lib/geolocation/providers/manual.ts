/**
 * Proveedor manual / mock: no llama APIs externas.
 * Útil en tests y cuando Nominatim no está disponible.
 */

import type {
  GeocodingSearchContext,
  NormalizedGeocodingResult,
} from "../types";
import { validateCoordinates } from "../coordinates";
import type { GeocodingProvider } from "./types";

export class ManualGeocodingProvider implements GeocodingProvider {
  readonly id = "manual";

  normalize(raw: unknown): NormalizedGeocodingResult | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const coords = validateCoordinates(r.latitude ?? r.lat, r.longitude ?? r.lon ?? r.lng);
    if (!coords.ok) return null;
    return {
      latitude: coords.coordinates.latitude,
      longitude: coords.coordinates.longitude,
      displayName: String(r.displayName || r.display_name || "Ubicación manual"),
      countryCode: (r.countryCode as string) || "AR",
      countryName: (r.countryName as string) || "Argentina",
      province: (r.province as string) || null,
      city: (r.city as string) || null,
      address: (r.address as string) || null,
      postalCode: (r.postalCode as string) || null,
      locationName: (r.locationName as string) || (r.venueName as string) || null,
      placeId: (r.placeId as string) || null,
      precision: "COORDINATE",
      provider: "manual",
      raw,
    };
  }

  async search(
    query: string,
    context?: GeocodingSearchContext,
  ): Promise<NormalizedGeocodingResult[]> {
    void query;
    void context;
    return [];
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<NormalizedGeocodingResult | null> {
    const coords = validateCoordinates(latitude, longitude);
    if (!coords.ok) return null;
    return {
      latitude: coords.coordinates.latitude,
      longitude: coords.coordinates.longitude,
      displayName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      countryCode: "AR",
      countryName: "Argentina",
      province: null,
      city: null,
      address: null,
      postalCode: null,
      locationName: null,
      placeId: null,
      precision: "COORDINATE",
      provider: "manual",
    };
  }
}
