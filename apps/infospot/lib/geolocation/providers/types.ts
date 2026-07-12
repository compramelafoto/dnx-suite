import type {
  GeocodingSearchContext,
  NormalizedGeocodingResult,
} from "../types";

export interface GeocodingProvider {
  readonly id: string;
  search(
    query: string,
    context?: GeocodingSearchContext,
  ): Promise<NormalizedGeocodingResult[]>;
  reverse(
    latitude: number,
    longitude: number,
  ): Promise<NormalizedGeocodingResult | null>;
  normalize(raw: unknown): NormalizedGeocodingResult | null;
}
