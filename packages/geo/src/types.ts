/**
 * Tipos base del DNX GEO ENGINE.
 * Independientes de InfoSpot, CLF u otras apps.
 */

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const LOCATION_PRECISIONS = [
  "COUNTRY",
  "PROVINCE",
  "CITY",
  "NEIGHBORHOOD",
  "VENUE",
  "ADDRESS",
  "COORDINATE",
] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const GEOGRAPHIC_SCOPES = [
  "LOCAL",
  "PROVINCIAL",
  "NATIONAL",
  "INTERNATIONAL",
  "UNSPECIFIED",
] as const;
export type GeographicScope = (typeof GEOGRAPHIC_SCOPES)[number];

/** Resultado normalizado de un proveedor de geocoding. */
export type NormalizedPlace = {
  latitude: number;
  longitude: number;
  displayName: string;
  countryCode: string | null;
  countryName: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  locationName: string | null;
  placeId: string | null;
  precision: LocationPrecision;
  provider: string;
  raw?: unknown;
};

export type GeocodingSearchContext = {
  countryCode?: string;
  city?: string;
  province?: string;
  limit?: number;
};

/**
 * Contrato común de ubicación editorial/operativa.
 * Cada app mapea su modelo a este shape vía adaptadores.
 */
export type DnxLocation = {
  geographicScope?: GeographicScope | null;
  countryCode?: string | null;
  countryName?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
};

export type GeocodingProvider = {
  readonly id: string;
  search(
    query: string,
    context?: GeocodingSearchContext,
  ): Promise<NormalizedPlace[]>;
  reverse(latitude: number, longitude: number): Promise<NormalizedPlace | null>;
  normalize?(raw: unknown): NormalizedPlace | null;
};
