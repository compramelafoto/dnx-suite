/**
 * Ruido del sensor según ISO.
 *
 * Subir el ISO amplifica la señal y también su ruido: la desviación crece con
 * √(ISO) y pesa mucho más en las sombras (ruido de disparo ∝ √señal más un
 * piso de lectura). A ISO 100 es invisible; a ISO 3200 se nota en sombras y a
 * ISO 25600 ensucia hasta los tonos medios.
 */

import { exactIso } from "./exposure-scales";

/** Desviación del ruido de luminancia a ISO 100 para un gris medio, antes de √señal. */
const BASE_SIGMA_ISO100 = 0.0045;
/** Piso de lectura: evita que el negro puro quede sin ruido. */
export const SENSOR_READ_FLOOR = 0.02;
/** El ruido de color es más débil que el de luminancia. */
export const CHROMA_NOISE_RATIO = 0.5;

/** Factor del ruido para el shader: σ(x) = factor · √(x + piso). */
export function isoNoiseFactor(iso: number): number {
  return BASE_SIGMA_ISO100 * Math.sqrt(exactIso(iso) / 100);
}

/** Desviación esperada para un valor de pantalla (0…1) a un ISO dado. */
export function isoNoiseSigma(iso: number, signal: number): number {
  return isoNoiseFactor(iso) * Math.sqrt(Math.max(0, signal) + SENSOR_READ_FLOOR);
}
