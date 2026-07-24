/**
 * Cliente Nominatim (OpenStreetMap) — sin API key.
 * Solo usar en servidor / proxy. Respetar User-Agent y rate limit.
 */

import type {
  GeocodingProvider,
  GeocodingSearchContext,
  LocationPrecision,
  NormalizedPlace,
} from "../types";

type NominatimAddress = {
  country_code?: string;
  country?: string;
  state?: string;
  province?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  neighbourhood?: string;
  road?: string;
  house_number?: string;
  postcode?: string;
  amenity?: string;
  building?: string;
  tourism?: string;
};

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  address?: NominatimAddress;
};

export type NominatimClientOptions = {
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

function inferPrecision(hit: NominatimHit): LocationPrecision {
  const a = hit.address;
  if (a?.house_number && a?.road) return "ADDRESS";
  if (a?.amenity || a?.building || a?.tourism) return "VENUE";
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
  return (
    a.city?.trim() ||
    a.town?.trim() ||
    a.village?.trim() ||
    a.municipality?.trim() ||
    null
  );
}

export function normalizeNominatimHit(hit: NominatimHit): NormalizedPlace | null {
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

  return {
    latitude,
    longitude,
    displayName: hit.display_name,
    countryCode: a?.country_code?.toUpperCase() || null,
    countryName: a?.country || null,
    province: a?.state?.trim() || a?.province?.trim() || null,
    city: cityFromAddress(a),
    address: buildAddressLine(a),
    postalCode: a?.postcode || null,
    locationName:
      a?.amenity?.trim() || a?.tourism?.trim() || a?.building?.trim() || null,
    placeId,
    precision: inferPrecision(hit),
    provider: "nominatim",
    raw: hit,
  };
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly id = "nominatim";
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NominatimClientOptions = {}) {
    this.userAgent =
      options.userAgent?.trim() ||
      (typeof process !== "undefined" && process.env?.GEOCODING_USER_AGENT?.trim()) ||
      "DNX-Suite-Geo/1.0 (dnx-suite; shared-geo-engine)";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  normalize(raw: unknown): NormalizedPlace | null {
    if (!raw || typeof raw !== "object") return null;
    return normalizeNominatimHit(raw as NominatimHit);
  }

  private async fetchJson(url: URL): Promise<unknown> {
    const res = await this.fetchImpl(url.toString(), {
      headers: {
        "User-Agent": this.userAgent,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return res.json();
  }

  async search(
    query: string,
    context?: GeocodingSearchContext,
  ): Promise<NormalizedPlace[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(Math.min(10, context?.limit ?? 5)));
    url.searchParams.set(
      "countrycodes",
      (context?.countryCode || "ar").toLowerCase(),
    );

    const data = await this.fetchJson(url);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => this.normalize(item))
      .filter((x): x is NormalizedPlace => x != null);
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<NormalizedPlace | null> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    const data = await this.fetchJson(url);
    return this.normalize(data);
  }
}

export function createNominatimProvider(
  options?: NominatimClientOptions,
): NominatimGeocodingProvider {
  return new NominatimGeocodingProvider(options);
}
