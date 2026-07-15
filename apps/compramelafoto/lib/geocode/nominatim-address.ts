/** Campos de ciudad/localidad en respuestas de Nominatim (orden de prioridad). */
const CITY_FIELD_PRIORITY = [
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "county",
] as const;

export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
export const NOMINATIM_USER_AGENT_SEARCH = "ComprameLaFoto/1.0 (fotografia-escolar)";
export const NOMINATIM_USER_AGENT_REVERSE = "CompraMeLaFoto/1.0 (event location search)";
export const GEOCODE_MAX_QUERY_LENGTH = 200;
export const GEOCODE_MIN_QUERY_LENGTH = 3;
export const GEOCODE_FETCH_TIMEOUT_MS = 8000;

/**
 * Extrae el nombre de ciudad/localidad desde `address` de Nominatim.
 * No usa `display_name` (el orden de segmentos varía y puede devolver números de calle).
 */
export function extractCityFromNominatimAddress(
  address: Record<string, string | undefined> | null | undefined
): string {
  if (!address) return "";

  for (const key of CITY_FIELD_PRIORITY) {
    const value = address[key]?.trim();
    if (value) return value;
  }

  const state = address.state?.trim();
  if (state) return state;

  return address.country?.trim() ?? "";
}

export function normalizeGeocodeQuery(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const q = raw.trim().slice(0, GEOCODE_MAX_QUERY_LENGTH);
  if (q.length < GEOCODE_MIN_QUERY_LENGTH) return null;
  return q;
}

export function parseLatLon(
  latRaw: string | null,
  lonRaw: string | null
): { ok: true; lat: number; lon: number } | { ok: false; error: string } {
  const lat = latRaw != null ? parseFloat(String(latRaw)) : NaN;
  const lon = lonRaw != null ? parseFloat(String(lonRaw)) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: "Parámetros lat y lon requeridos y numéricos" };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: "lat/lon fuera de rango" };
  }
  return { ok: true, lat, lon };
}

export type NominatimSearchHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

export function mapNominatimSearchResults(data: NominatimSearchHit[]) {
  return data.map((r) => {
    const address = r.address || {};
    return {
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      address,
      city: extractCityFromNominatimAddress(address),
    };
  });
}

export async function fetchNominatimJson(
  url: string,
  userAgent: string,
  acceptLanguage?: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
