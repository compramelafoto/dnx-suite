/**
 * Servicio de geolocalización reutilizable (redacción, público, inbound, outbound).
 */

import { prisma } from "@repo/db";
import { geocodeCacheKey, getCachedGeocode, setCachedGeocode } from "./cache";
import { validateCoordinates } from "./coordinates";
import { encodeGeohash } from "./geohash";
import { getGeocodingProvider } from "./providers";
import type {
  EventLocationFields,
  GeocodingSearchContext,
  LocationVisibility,
  NormalizedGeocodingResult,
} from "./types";

export async function searchEventLocations(
  query: string,
  context?: GeocodingSearchContext,
): Promise<NormalizedGeocodingResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const key = geocodeCacheKey("search", [
    q,
    context?.countryCode || "ar",
    context?.city || "",
    context?.province || "",
    String(context?.limit ?? 5),
  ]);
  const cached = getCachedGeocode<NormalizedGeocodingResult[]>(key);
  if (cached) return cached;

  const provider = getGeocodingProvider();
  const results = await provider.search(q, context);
  setCachedGeocode(key, results);
  return results;
}

export async function geocodeEventAddress(
  query: string,
  context?: GeocodingSearchContext,
): Promise<NormalizedGeocodingResult | null> {
  const results = await searchEventLocations(query, { ...context, limit: 1 });
  return results[0] ?? null;
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<NormalizedGeocodingResult | null> {
  const coords = validateCoordinates(latitude, longitude);
  if (!coords.ok) return null;

  const key = geocodeCacheKey("reverse", [
    coords.coordinates.latitude.toFixed(5),
    coords.coordinates.longitude.toFixed(5),
  ]);
  const cached = getCachedGeocode<NormalizedGeocodingResult | null>(key);
  if (cached !== null && cached !== undefined) return cached;

  const provider = getGeocodingProvider();
  const result = await provider.reverse(
    coords.coordinates.latitude,
    coords.coordinates.longitude,
  );
  setCachedGeocode(key, result);
  return result;
}

export function normalizeGeocodingResult(
  raw: unknown,
): NormalizedGeocodingResult | null {
  return getGeocodingProvider().normalize(raw);
}

export function fieldsFromGeocodingResult(
  result: NormalizedGeocodingResult,
  opts?: { status?: "GEOCODED" | "NEEDS_REVIEW" | "CONFIRMED" },
): Partial<EventLocationFields> {
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    geohash: encodeGeohash(result.latitude, result.longitude),
    city: result.city,
    province: result.province,
    address: result.address,
    venueName: result.locationName,
    postalCode: result.postalCode,
    countryCode: result.countryCode || "AR",
    countryName: result.countryName || "Argentina",
    locationPrecision: result.precision,
    geocodingProvider: result.provider,
    geocodingPlaceId: result.placeId,
    geocodingStatus: opts?.status || "GEOCODED",
    geocodedAt: new Date(),
  };
}

export async function confirmEventLocation(input: {
  eventId: string;
  userId: number | null;
  latitude: number;
  longitude: number;
  city: string;
  province: string;
  address?: string | null;
  venueName?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  locationVisibility?: LocationVisibility;
  geocodingProvider?: string | null;
  geocodingPlaceId?: string | null;
  locationPrecision?: EventLocationFields["locationPrecision"];
  setOverride?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const coords = validateCoordinates(input.latitude, input.longitude);
  if (!coords.ok) return { ok: false, error: coords.reason };
  if (!input.city.trim()) return { ok: false, error: "Falta ciudad." };
  if (!input.province.trim()) return { ok: false, error: "Falta provincia." };

  const now = new Date();
  await prisma.infoSpotEvent.update({
    where: { id: input.eventId },
    data: {
      latitude: coords.coordinates.latitude,
      longitude: coords.coordinates.longitude,
      geohash: encodeGeohash(
        coords.coordinates.latitude,
        coords.coordinates.longitude,
      ),
      city: input.city.trim(),
      province: input.province.trim(),
      address: input.address?.trim() || null,
      venueName: input.venueName?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      countryCode: input.countryCode?.trim() || "AR",
      countryName: input.countryName?.trim() || "Argentina",
      locationPrecision: input.locationPrecision || "COORDINATE",
      geocodingProvider: input.geocodingProvider || "manual",
      geocodingPlaceId: input.geocodingPlaceId || null,
      geocodingStatus: "CONFIRMED",
      geocodedAt: now,
      locationConfirmedAt: now,
      locationConfirmedByUserId: input.userId,
      locationVisibility: input.locationVisibility || "CITY_ONLY",
      ...(input.setOverride
        ? { locationOverridden: true, coordinatesOverridden: true }
        : {}),
    },
  });

  return { ok: true };
}

export async function markLocationNeedsReview(
  eventId: string,
  reason?: string,
): Promise<void> {
  await prisma.infoSpotEvent.update({
    where: { id: eventId },
    data: {
      geocodingStatus: "NEEDS_REVIEW",
      locationConfirmedAt: null,
      locationConfirmedByUserId: null,
      ...(reason
        ? {
            /* reason queda en logs; no hay campo dedicado en schema */
          }
        : {}),
    },
  });
  if (reason) {
    console.info("[geolocation] needs_review", { eventId, reason });
  }
}

export function applyInboundGeolocation(
  existing: {
    locationOverridden: boolean;
    coordinatesOverridden: boolean;
    city: string;
    province: string;
    address: string | null;
    venueName: string | null;
    latitude: number | null;
    longitude: number | null;
    geocodingStatus: string;
    locationConfirmedAt: Date | null;
  },
  incoming: {
    city: string;
    province: string;
    address: string | null;
    venueName: string | null;
    latitude: number | null;
    longitude: number | null;
    missingGeoref: boolean;
  },
): {
  data: Record<string, unknown>;
  applied: string[];
  skipped: string[];
} {
  const data: Record<string, unknown> = {};
  const applied: string[] = [];
  const skipped: string[] = [];

  if (!existing.locationOverridden) {
    if (existing.city !== incoming.city) {
      data.city = incoming.city;
      applied.push("city synced");
    }
    if (
      (existing.province === "A confirmar" || !existing.province?.trim()) &&
      incoming.province !== existing.province
    ) {
      data.province = incoming.province;
      applied.push("province synced");
    }
    if (existing.venueName !== incoming.venueName) {
      data.venueName = incoming.venueName;
      applied.push("venueName synced");
    }
    if (existing.address !== incoming.address) {
      data.address = incoming.address;
      applied.push("address synced");
    }
  } else {
    skipped.push("location overridden");
  }

  if (!existing.coordinatesOverridden) {
    if (existing.latitude !== incoming.latitude) {
      data.latitude = incoming.latitude;
      applied.push("latitude synced");
    }
    if (existing.longitude !== incoming.longitude) {
      data.longitude = incoming.longitude;
      applied.push("longitude synced");
    }

    if (incoming.missingGeoref) {
      if (
        existing.geocodingStatus !== "CONFIRMED" &&
        !existing.locationConfirmedAt
      ) {
        data.geocodingStatus = "NEEDS_REVIEW";
        applied.push("geocodingStatus=NEEDS_REVIEW");
      }
    } else if (
      existing.geocodingStatus !== "CONFIRMED" &&
      !existing.locationConfirmedAt
    ) {
      data.geocodingStatus = "GEOCODED";
      data.geocodedAt = new Date();
      if (incoming.latitude != null && incoming.longitude != null) {
        data.geohash = encodeGeohash(incoming.latitude, incoming.longitude);
        data.locationPrecision = "COORDINATE";
        data.geocodingProvider = "compramelafoto";
      }
      applied.push("geocodingStatus=GEOCODED");
    }
  } else {
    skipped.push("coordinates overridden");
    if (
      incoming.latitude != null &&
      incoming.longitude != null &&
      (incoming.latitude !== existing.latitude ||
        incoming.longitude !== existing.longitude)
    ) {
      skipped.push("clf_coords_diverged_alert");
    }
  }

  return { data, applied, skipped };
}
