/** Centro aproximado de Argentina (mapas admin / cobertura). */
export const ARGENTINA_CENTER: [number, number] = [-38.4161, -63.6167];

export const ARGENTINA_DEFAULT_ZOOM = 4;

/** Límites aproximados del territorio argentino (SW, NE). */
export const ARGENTINA_BOUNDS: [[number, number], [number, number]] = [
  [-55.25, -73.56],
  [-21.78, -53.59],
];

export function isCoordPairValid(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function isInsideArgentinaBounds(lat: number, lng: number): boolean {
  const [[south, west], [north, east]] = ARGENTINA_BOUNDS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
