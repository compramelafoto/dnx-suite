/**
 * Tipos de dominio para geolocalización de eventos Info Spot.
 */

export const GEOCODING_STATUSES = [
  "PENDING",
  "GEOCODED",
  "CONFIRMED",
  "FAILED",
  "NEEDS_REVIEW",
] as const;
export type GeocodingStatus = (typeof GEOCODING_STATUSES)[number];

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

export const LOCATION_VISIBILITIES = [
  "EXACT",
  "APPROXIMATE",
  "CITY_ONLY",
  "HIDDEN",
] as const;
export type LocationVisibility = (typeof LOCATION_VISIBILITIES)[number];

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type NormalizedGeocodingResult = {
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

export type EventLocationFields = {
  city?: string | null;
  province?: string | null;
  address?: string | null;
  venueName?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  locationPrecision?: LocationPrecision | null;
  geocodingProvider?: string | null;
  geocodingPlaceId?: string | null;
  geocodingStatus?: GeocodingStatus | null;
  geocodedAt?: Date | null;
  locationConfirmedAt?: Date | null;
  locationConfirmedByUserId?: number | null;
  locationVisibility?: LocationVisibility | null;
  locationOverridden?: boolean | null;
  coordinatesOverridden?: boolean | null;
};

export type PublicEventLocation = {
  label: string;
  city: string | null;
  province: string | null;
  venueName: string | null;
  address: string | null;
  showExactAddress: boolean;
  showCoordinates: boolean;
  latitude: number | null;
  longitude: number | null;
};
