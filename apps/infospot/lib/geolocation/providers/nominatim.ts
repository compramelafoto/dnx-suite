/**
 * Proveedor Nominatim (OpenStreetMap) — sin API key.
 * Solo se usa en servidor (proxy). Respetar User-Agent y rate limit.
 */

import type {
  GeocodingSearchContext,
  LocationPrecision,
  NormalizedGeocodingResult,
} from "../types";
import {
  cleanMunicipalityLabel,
  parseDisplayNameFallback,
} from "../parse-display-name";
import type { GeocodingProvider } from "./types";

export { parseDisplayNameFallback } from "../parse-display-name";

type NominatimAddress = {
  country_code?: string;
  country?: string;
  state?: string;
  province?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  suburb?: string;
  neighbourhood?: string;
  road?: string;
  house_number?: string;
  postcode?: string;
  amenity?: string;
  building?: string;
  tourism?: string;
  leisure?: string;
  shop?: string;
  office?: string;
  club?: string;
  craft?: string;
  historic?: string;
  name?: string;
};

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  type?: string;
  class?: string;
  address?: NominatimAddress;
};

const USER_AGENT =
  process.env.GEOCODING_USER_AGENT?.trim() ||
  "InfoSpot/1.0 (dnx-suite; editorial-events)";

function inferPrecision(hit: NominatimHit): LocationPrecision {
  const a = hit.address;
  if (a?.house_number && a?.road) return "ADDRESS";
  if (
    a?.amenity ||
    a?.building ||
    a?.tourism ||
    a?.leisure ||
    a?.shop ||
    a?.club ||
    hit.name
  ) {
    return "VENUE";
  }
  if (a?.neighbourhood || a?.suburb) return "NEIGHBORHOOD";
  if (a?.city || a?.town || a?.village || a?.municipality) return "CITY";
  if (a?.state || a?.province) return "PROVINCE";
  if (a?.country) return "COUNTRY";
  return "COORDINATE";
}

function buildAddressLine(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  const parts = [a.road, a.house_number].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" ").trim();
}

function cityFromAddress(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  const raw =
    a.city?.trim() ||
    a.town?.trim() ||
    a.village?.trim() ||
    a.municipality?.trim() ||
    a.city_district?.trim() ||
    null;
  if (!raw) return null;
  const cleaned = cleanMunicipalityLabel(raw);
  return cleaned || null;
}

function provinceFromAddress(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  return a.state?.trim() || a.province?.trim() || null;
}

function venueFromHit(hit: NominatimHit): string | null {
  const a = hit.address;
  const fromAddress =
    a?.amenity?.trim() ||
    a?.tourism?.trim() ||
    a?.leisure?.trim() ||
    a?.building?.trim() ||
    a?.shop?.trim() ||
    a?.office?.trim() ||
    a?.club?.trim() ||
    a?.craft?.trim() ||
    a?.historic?.trim() ||
    a?.name?.trim() ||
    null;
  if (fromAddress) return fromAddress;
  const topName = hit.name?.trim();
  if (topName) return topName;
  return null;
}

export function normalizeNominatimHit(
  hit: NominatimHit,
): NormalizedGeocodingResult | null {
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;

  const a = hit.address;
  const placeId =
    hit.place_id != null
      ? `nominatim:${hit.place_id}`
      : hit.osm_type && hit.osm_id != null
        ? `osm:${hit.osm_type}/${hit.osm_id}`
        : null;

  const fromDisplay = parseDisplayNameFallback(hit.display_name || "");

  const city = cityFromAddress(a) || fromDisplay.city;
  const province = provinceFromAddress(a) || fromDisplay.province;
  const locationName = venueFromHit(hit) || fromDisplay.venueName;
  const address = buildAddressLine(a) || fromDisplay.address;
  const postalCode = a?.postcode?.trim() || fromDisplay.postalCode;

  return {
    latitude,
    longitude,
    displayName: hit.display_name,
    countryCode: a?.country_code?.toUpperCase() || null,
    countryName: a?.country || null,
    province,
    city,
    address,
    postalCode,
    locationName,
    placeId,
    precision: inferPrecision(hit),
    provider: "nominatim",
    raw: hit,
  };
}

async function fetchNominatim(url: URL): Promise<unknown> {
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }
  return res.json();
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly id = "nominatim";

  normalize(raw: unknown): NormalizedGeocodingResult | null {
    if (!raw || typeof raw !== "object") return null;
    return normalizeNominatimHit(raw as NominatimHit);
  }

  async search(
    query: string,
    context?: GeocodingSearchContext,
  ): Promise<NormalizedGeocodingResult[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(Math.min(10, context?.limit ?? 5)));
    url.searchParams.set("countrycodes", (context?.countryCode || "ar").toLowerCase());

    const data = await fetchNominatim(url);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => this.normalize(item))
      .filter((x): x is NormalizedGeocodingResult => x != null);
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<NormalizedGeocodingResult | null> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");

    const data = await fetchNominatim(url);
    return this.normalize(data);
  }
}
