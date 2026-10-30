/**
 * Deshacer y rehacer: el estado de antes, el actual y los que se pueden rehacer. Guarda los
 * estados enteros —la composición es chica y no lleva imágenes—, así deshacer nunca reconstruye
 * nada a mano.
 */
export type Historial<T> = { pasado: T[]; actual: T; futuro: T[] };

export const PASOS_MAXIMOS = 50;

export function iniciar<T>(t: T): Historial<T> {
  return { pasado: [], actual: t, futuro: [] };
}

export function registrar<T>(h: Historial<T>, t: T, max = PASOS_MAXIMOS): Historial<T> {
  if (t === h.actual) return h;
  return { pasado: [...h.pasado, h.actual].slice(-max), actual: t, futuro: [] };
}

export function deshacer<T>(h: Historial<T>): Historial<T> {
  if (!h.pasado.length) return h;
  return { pasado: h.pasado.slice(0, -1), actual: h.pasado[h.pasado.length - 1], futuro: [h.actual, ...h.futuro] };
}

export function rehacer<T>(h: Historial<T>): Historial<T> {
  if (!h.futuro.length) return h;
  return { pasado: [...h.pasado, h.actual], actual: h.futuro[0], futuro: h.futuro.slice(1) };
}

export const puedeDeshacer = <T>(h: Historial<T>) => h.pasado.length > 0;
export const puedeRehacer = <T>(h: Historial<T>) => h.futuro.length > 0;
