/**
 * Geohash (base32).
 * Precisión 7 ≈ ~150 m; 8 ≈ ~38 m.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Precisión por defecto (~150 m) — alineada a InfoSpot. */
export const DEFAULT_GEOHASH_PRECISION = 7;

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision = DEFAULT_GEOHASH_PRECISION,
): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = "";

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        idx = idx * 2 + 1;
        lonMin = mid;
      } else {
        idx = idx * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

/** Prefijo de geohash aproximado para un radio en km (heurística CLF). */
export function geohashPrefixForRadiusKm(radiusKm: number): number {
  if (radiusKm >= 20) return 4;
  if (radiusKm >= 5) return 5;
  if (radiusKm >= 1) return 6;
  if (radiusKm >= 0.5) return 6;
  return 7;
}

/** True si dos geohashes comparten prefijo de longitud `prefixLen`. */
export function geohashSharesPrefix(
  a: string | null | undefined,
  b: string | null | undefined,
  prefixLen: number,
): boolean {
  if (!a || !b || prefixLen <= 0) return false;
  return a.slice(0, prefixLen) === b.slice(0, prefixLen);
}
