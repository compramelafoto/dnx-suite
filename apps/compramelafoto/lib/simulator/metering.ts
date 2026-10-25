/**
 * Fotómetro de la cámara — Cam Of Duty.
 *
 * Mide la imagen real del recuadro (luminancia lineal antes de la exposición),
 * como el fotómetro TTL de una cámara, en tres modos:
 * - Matricial: divide el cuadro en zonas, recorta las luces extremas (sol,
 *   cielo quemado) y promedia con más peso al centro.
 * - Ponderada al centro: 75 % un círculo central (medio alto del cuadro) y
 *   25 % el resto.
 * - Puntual: sólo un círculo central del 3,5 % del cuadro.
 *
 * Toda medición apunta al gris medio (18 %): si el recuadro es blanco, el
 * fotómetro lo deja gris (subexpone); si es negro, lo deja gris (sobreexpone).
 */

export type MeteringMode = "MATRIX" | "CENTER" | "SPOT";

export const METERING_MODES: readonly MeteringMode[] = ["MATRIX", "CENTER", "SPOT"];

export const METERING_LABELS: Record<MeteringMode, string> = {
  MATRIX: "Matricial",
  CENTER: "Ponderada al centro",
  SPOT: "Puntual",
};

/** Reflectancia del gris medio al que apunta todo fotómetro. */
export const MID_GREY = 0.18;

/** Grilla de luminancia lineal del recuadro (fila 0 = arriba). */
export interface MeterGrid {
  width: number;
  height: number;
  luminance: ArrayLike<number>;
}

const SPOT_AREA_FRACTION = 0.035;
const CENTER_WEIGHT = 0.75;
const CENTER_DIAMETER_FRACTION_OF_HEIGHT = 0.5;
const MATRIX_ZONES = 3;
const MATRIX_CENTER_WEIGHT = 3;
/** Una zona no cuenta más de este múltiplo de la mediana (el sol no manda). */
const MATRIX_HIGHLIGHT_CLIP = 4;
const EPS = 1e-6;

function cellDistance(grid: MeterGrid, x: number, y: number): number {
  const cx = (grid.width - 1) / 2;
  const cy = (grid.height - 1) / 2;
  return Math.hypot(x - cx, y - cy);
}

function meanWhere(grid: MeterGrid, keep: (x: number, y: number) => boolean): number | null {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!keep(x, y)) continue;
      sum += Math.max(0, grid.luminance[y * grid.width + x]);
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

function spotRadius(grid: MeterGrid): number {
  return Math.max(0.75, Math.sqrt((SPOT_AREA_FRACTION * grid.width * grid.height) / Math.PI));
}

function meterSpot(grid: MeterGrid): number {
  const r = spotRadius(grid);
  return meanWhere(grid, (x, y) => cellDistance(grid, x, y) <= r) ?? 0;
}

function meterCenter(grid: MeterGrid): number {
  const r = (grid.height * CENTER_DIAMETER_FRACTION_OF_HEIGHT) / 2;
  const inside = meanWhere(grid, (x, y) => cellDistance(grid, x, y) <= r);
  const outside = meanWhere(grid, (x, y) => cellDistance(grid, x, y) > r);
  if (inside == null) return outside ?? 0;
  if (outside == null) return inside;
  return CENTER_WEIGHT * inside + (1 - CENTER_WEIGHT) * outside;
}

function meterMatrix(grid: MeterGrid): number {
  const zones: { mean: number; weight: number }[] = [];
  for (let zy = 0; zy < MATRIX_ZONES; zy += 1) {
    for (let zx = 0; zx < MATRIX_ZONES; zx += 1) {
      const x0 = Math.floor((zx * grid.width) / MATRIX_ZONES);
      const x1 = Math.floor(((zx + 1) * grid.width) / MATRIX_ZONES);
      const y0 = Math.floor((zy * grid.height) / MATRIX_ZONES);
      const y1 = Math.floor(((zy + 1) * grid.height) / MATRIX_ZONES);
      const mean = meanWhere(grid, (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1);
      if (mean == null) continue;
      const center = zx === 1 && zy === 1;
      zones.push({ mean, weight: center ? MATRIX_CENTER_WEIGHT : 1 });
    }
  }
  if (zones.length === 0) return 0;
  const sorted = zones.map((z) => z.mean).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const cap = Math.max(EPS, median * MATRIX_HIGHLIGHT_CLIP);
  let logSum = 0;
  let wSum = 0;
  for (const z of zones) {
    logSum += Math.log2(Math.max(EPS, Math.min(z.mean, cap))) * z.weight;
    wSum += z.weight;
  }
  return 2 ** (logSum / wSum);
}

/** Luminancia lineal (unidades del render) que el modo considera "gris medio". */
export function meterLuminance(grid: MeterGrid, mode: MeteringMode): number {
  if (grid.width <= 0 || grid.height <= 0) return 0;
  if (mode === "SPOT") return meterSpot(grid);
  if (mode === "CENTER") return meterCenter(grid);
  return meterMatrix(grid);
}

/**
 * EV100 de la escena medida: brillo absoluto del lugar (EV100 de un gris
 * medio de 0,18 unidades de render) corregido por lo que ve el fotómetro.
 */
export function meteredEv100(sceneBrightnessEv100: number, meteredLuminance: number): number {
  return sceneBrightnessEv100 + Math.log2(Math.max(EPS, meteredLuminance) / MID_GREY);
}

/** Lecturas de los tres modos a la vez (en log2, para suavizar en el tiempo). */
export interface MeterReadings {
  MATRIX: number;
  CENTER: number;
  SPOT: number;
}

export function readAllModes(grid: MeterGrid): MeterReadings {
  return {
    MATRIX: Math.log2(Math.max(EPS, meterLuminance(grid, "MATRIX"))),
    CENTER: Math.log2(Math.max(EPS, meterLuminance(grid, "CENTER"))),
    SPOT: Math.log2(Math.max(EPS, meterLuminance(grid, "SPOT"))),
  };
}

/** Suavizado exponencial de lecturas (el fotómetro no salta cuadro a cuadro). */
export function smoothReadings(
  prev: MeterReadings | null,
  next: MeterReadings,
  dtSeconds: number,
  timeConstantSeconds = 0.25,
): MeterReadings {
  if (!prev) return next;
  const a = 1 - Math.exp(-Math.max(0, dtSeconds) / timeConstantSeconds);
  return {
    MATRIX: prev.MATRIX + (next.MATRIX - prev.MATRIX) * a,
    CENTER: prev.CENTER + (next.CENTER - prev.CENTER) * a,
    SPOT: prev.SPOT + (next.SPOT - prev.SPOT) * a,
  };
}
