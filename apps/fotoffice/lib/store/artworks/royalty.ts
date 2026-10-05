/** Regalía del autor, en centavos enteros. Módulo PURO. */

/** `bps` en puntos básicos (2000 = 20 %). La base es el total de la línea sin envío. */
export function royaltyMinor(lineTotalMinor: number, bps: number): number {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new RangeError(`bps fuera de rango (0 a 10000): ${bps}`);
  }
  return Math.max(0, Math.round((lineTotalMinor * bps) / 10000));
}
