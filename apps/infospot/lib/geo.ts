/** Distancia Haversine en km. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Centroides aproximados ciudad/provincia (AR) para eventos sin lat/lng.
 * No es geocoding preciso: sirve para filtro de cercanía MVP.
 */
const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "buenos aires|caba": { lat: -34.6037, lng: -58.3816 },
  "caba|caba": { lat: -34.6037, lng: -58.3816 },
  "ciudad autonoma de buenos aires|caba": { lat: -34.6037, lng: -58.3816 },
  "la plata|buenos aires": { lat: -34.9214, lng: -57.9544 },
  "mar del plata|buenos aires": { lat: -38.0055, lng: -57.5426 },
  "cordoba|cordoba": { lat: -31.4201, lng: -64.1888 },
  "villa carlos paz|cordoba": { lat: -31.4241, lng: -64.4978 },
  "rosario|santa fe": { lat: -32.9442, lng: -60.6505 },
  "santa fe|santa fe": { lat: -31.6333, lng: -60.7 },
  "mendoza|mendoza": { lat: -32.8895, lng: -68.8458 },
  "san miguel de tucuman|tucuman": { lat: -26.8083, lng: -65.2176 },
  "salta|salta": { lat: -24.7821, lng: -65.4232 },
  "neuquen|neuquen": { lat: -38.9516, lng: -68.0591 },
  "bariloche|rio negro": { lat: -41.1335, lng: -71.3103 },
  "ushuaia|tierra del fuego": { lat: -54.8019, lng: -68.303 },
  "resistencia|chaco": { lat: -27.4514, lng: -58.9867 },
  "corrientes|corrientes": { lat: -27.4692, lng: -58.8306 },
  "posadas|misiones": { lat: -27.3671, lng: -55.8961 },
  "parana|entre rios": { lat: -31.7413, lng: -60.5115 },
  "san juan|san juan": { lat: -31.5375, lng: -68.5364 },
  "san luis|san luis": { lat: -33.3017, lng: -66.3378 },
  "rio cuarto|cordoba": { lat: -33.1301, lng: -64.3499 },
};

function normalizeKey(city: string, province: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  return `${norm(city)}|${norm(province)}`;
}

export function resolveEventCoords(input: {
  latitude?: number | null;
  longitude?: number | null;
  city: string;
  province: string;
}): { lat: number; lng: number } | null {
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return { lat: input.latitude, lng: input.longitude };
  }
  return CITY_CENTROIDS[normalizeKey(input.city, input.province)] ?? null;
}

export const NEAR_ME_RADIUS_KM = 100;

export function parseGeoParams(raw: {
  lat?: string;
  lng?: string;
  radio?: string;
}): { lat: number; lng: number; radiusKm: number } | null {
  const lat = raw.lat ? Number(raw.lat) : NaN;
  const lng = raw.lng ? Number(raw.lng) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const radiusKm = Math.min(
    300,
    Math.max(5, Number(raw.radio) || NEAR_ME_RADIUS_KM),
  );
  return { lat, lng, radiusKm };
}
