/**
 * Geohash (base32) — precisión ~7 ≈ ~150 m (adecuado para cercanía urbana).
 * No sustituye Haversine para distancias exactas.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Precisión por defecto al confirmar ubicación (≈150 m). */
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
