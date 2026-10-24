/**
 * Histograma de luminancia como el de una cámara: cuántos píxeles hay en cada
 * tono, de negro (izquierda) a blanco (derecha), ya con la exposición y la
 * curva de tono aplicadas (lo que muestra la pantalla o queda en la foto).
 */

export interface HistogramData {
  /** Proporción de píxeles por columna (suma 1). */
  bins: number[];
  /** Fracción de píxeles empastados en negro y quemados en blanco. */
  clippedShadows: number;
  clippedHighlights: number;
}

/** Curva ACES filmic (aproximación de Narkowicz), la misma familia que usa el render. */
function acesFilmic(x: number): number {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e)));
}

/** Lineal → sRGB (0–1). */
function encodeSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

const CLIP_LOW = 0.02;
const CLIP_HIGH = 0.98;

function fromValues(values: Iterable<number>, bins: number): HistogramData {
  const counts = new Array<number>(bins).fill(0);
  let total = 0;
  let low = 0;
  let high = 0;
  for (const v of values) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(v * bins)));
    counts[b] += 1;
    total += 1;
    if (v <= CLIP_LOW) low += 1;
    if (v >= CLIP_HIGH) high += 1;
  }
  if (total === 0) return { bins: counts, clippedShadows: 0, clippedHighlights: 0 };
  return { bins: counts.map((c) => c / total), clippedShadows: low / total, clippedHighlights: high / total };
}

/** Desde la luminancia lineal del render (grilla del fotómetro) y la exposición aplicada. */
export function histogramFromLuminance(luminance: ArrayLike<number>, exposure: number, bins = 64): HistogramData {
  const values: number[] = [];
  for (let i = 0; i < luminance.length; i += 1) values.push(encodeSrgb(acesFilmic(Math.max(0, luminance[i]) * exposure)));
  return fromValues(values, bins);
}

/** Desde los píxeles de una foto (RGBA de 8 bits, como los de un canvas). Luma Rec. 709. */
export function histogramFromPixels(rgba: ArrayLike<number>, bins = 64, step = 1): HistogramData {
  const values: number[] = [];
  for (let i = 0; i < rgba.length; i += 4 * step) {
    values.push((0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255);
  }
  return fromValues(values, bins);
}
