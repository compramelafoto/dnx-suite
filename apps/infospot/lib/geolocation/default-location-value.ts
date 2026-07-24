import type { LocationVisibility } from "@/lib/geolocation/types";

export type DefaultLocationValue = {
  city: string;
  province: string;
  address: string;
  venueName: string;
  postalCode: string;
  countryCode: string;
  countryName: string;
  latitude: number | null;
  longitude: number | null;
  locationVisibility: LocationVisibility;
  geocodingStatus: string | null;
  locationConfirmedAt: string | Date | null;
  geocodingPlaceId: string | null;
  geocodingProvider: string | null;
};

/** Pure helper — usable desde Server Components (no vive en módulos "use client"). */
export function defaultLocationValue(partial: {
  city?: string | null;
  province?: string | null;
  address?: string | null;
  venueName?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVisibility?: LocationVisibility | string | null;
  geocodingStatus?: string | null;
  locationConfirmedAt?: Date | string | null;
  geocodingPlaceId?: string | null;
  geocodingProvider?: string | null;
}): DefaultLocationValue {
  return {
    city: partial.city || "",
    province: partial.province || "",
    address: partial.address || "",
    venueName: partial.venueName || "",
    postalCode: partial.postalCode || "",
    countryCode: partial.countryCode || "AR",
    countryName: partial.countryName || "Argentina",
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    locationVisibility:
      (partial.locationVisibility as LocationVisibility) || "CITY_ONLY",
    geocodingStatus: partial.geocodingStatus || "PENDING",
    locationConfirmedAt: partial.locationConfirmedAt ?? null,
    geocodingPlaceId: partial.geocodingPlaceId ?? null,
    geocodingProvider: partial.geocodingProvider ?? null,
  };
}
