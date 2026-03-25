/**
 * Utilidades geográficas para álbumes colaborativos y eventos:
 * - geohash: encode lat/lng para búsqueda por proximidad
 * - haversine: distancia en metros entre dos puntos
 */

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Codifica lat/lng en geohash (precision = caracteres, ~5 bits cada uno).
 * Mayor precisión = área más pequeña.
 * precision 5 ≈ ±2.4km, 6 ≈ ±0.6km, 7 ≈ ±150m
 */
export function encodeGeohash(lat: number, lng: number, precision = 8): string {
  const idx: number[] = [];
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let isEven = true;

  while (idx.length < precision * 5) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      idx.push(lng >= mid ? 1 : 0);
      if (lng >= mid) lngMin = mid;
      else lngMax = mid;
    } else {
      const mid = (latMin + latMax) / 2;
      idx.push(lat >= mid ? 1 : 0);
      if (lat >= mid) latMin = mid;
      else latMax = mid;
    }
    isEven = !isEven;
  }

  let hash = "";
  for (let c = 0; c < precision; c++) {
    let n = 0;
    for (let b = 0; b < 5; b++) {
      n = (n << 1) | (idx[c * 5 + b] ?? 0);
    }
    hash += GEOHASH_BASE32[n];
  }
  return hash;
}

/**
 * Obtiene el prefijo de geohash que cubre aproximadamente un radio en km.
 * Para 2km ≈ precision 5, 0.2km ≈ precision 6, 0.5km ≈ precision 5-6
 */
export function geohashPrefixForRadiusKm(radiusKm: number): number {
  if (radiusKm >= 20) return 4;
  if (radiusKm >= 5) return 5;
  if (radiusKm >= 1) return 6;
  if (radiusKm >= 0.5) return 6;
  return 7;
}

/**
 * Distancia haversine en metros entre dos puntos WGS84.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Diferencia absoluta en horas entre dos fechas.
 */
export function hoursDiff(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60));
}
