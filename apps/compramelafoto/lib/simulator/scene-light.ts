/**
 * Luz absoluta de cada escena — Cam Of Duty.
 *
 * Una cámara real mide luz absoluta: un día de sol pleno es EV100 ≈ 15 (de
 * ahí la regla del "sol 16": ISO 100, 1/125, f/16), una calle de noche con
 * alumbrado ronda EV100 4. El render 3D no tiene unidades físicas, así que
 * cada escena se calibra: desde su punto de partida, el fotómetro matricial
 * debe leer el EV100 real de esa hora. A partir de ahí, lo que cambia la
 * lectura es la imagen (apuntar al cielo, a una sombra, a una pared negra).
 */

import { clampTimeOfDayMinutes } from "./natural-light";
import { MID_GREY } from "./metering";
import type { SimulatorSceneId } from "./scenes";

const SUNRISE_MIN = 6 * 60 + 15;
const SUNSET_MIN = 19 * 60 + 30;
const TWILIGHT_MIN = 90;

/** Puntos de referencia de la luz del día (minutos → EV100 de una escena típica). */
const DAYLIGHT_EV100: readonly [number, number][] = [
  [0, 4],
  [SUNRISE_MIN - TWILIGHT_MIN, 4],
  [SUNRISE_MIN - TWILIGHT_MIN / 2, 7],
  [SUNRISE_MIN, 11],
  [SUNRISE_MIN + 60, 13],
  [9 * 60, 14],
  [11 * 60, 15],
  [14 * 60, 15],
  [16 * 60 + 30, 14],
  [SUNSET_MIN - 60, 13],
  [SUNSET_MIN, 11],
  [SUNSET_MIN + TWILIGHT_MIN / 2, 8],
  [SUNSET_MIN + TWILIGHT_MIN, 4],
  [24 * 60, 4],
];

function interpolate(points: readonly [number, number][], x: number): number {
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * Math.max(0, Math.min(1, t));
    }
  }
  return points[points.length - 1][1];
}

/** EV100 real de una escena exterior típica a esa hora (sol pleno = 15). */
export function daylightEv100(minutes: number): number {
  return interpolate(DAYLIGHT_EV100, clampTimeOfDayMinutes(minutes));
}

/**
 * Nivel del render (luminancia lineal) que el fotómetro matricial lee desde
 * el punto de partida de cada escena, medido en el navegador por hora.
 * Se interpola en log2 entre horas. Hay que volver a medir si cambia la
 * iluminación o los modelos de una escena.
 */
export const SCENE_RENDER_CALIBRATION_LOG2: Record<SimulatorSceneId, readonly [number, number][]> = {
  // Medido el 23/10/2026 en next dev (Playwright, 1400×900), matricial, punto de partida.
  // Calle 3D: punto de partida en la esquina, vereda este.
  "photographic-city": [
    [0, -6.5],
    [285, -6.5],
    [330, -6.5],
    [375, -2.98],
    [435, -0.88],
    [540, -0.41],
    [660, -0.23],
    [750, -0.11],
    [840, -0.26],
    [990, -0.9],
    [1110, -2.41],
    [1170, -6.77],
    [1215, -6.59],
    [1260, -6.5],
    [1320, -6.5],
    [1440, -6.5],
  ],
};

function calibratedRenderLog2(sceneId: SimulatorSceneId, minutes: number): number {
  const table = SCENE_RENDER_CALIBRATION_LOG2[sceneId] ?? [[0, Math.log2(MID_GREY)]];
  if (table.length === 1) return table[0][1];
  return interpolate(table, clampTimeOfDayMinutes(minutes));
}

/** EV100 real de la escena a esa hora (lo que debería leer el fotómetro de partida). */
export function sceneReferenceEv100(_sceneId: SimulatorSceneId, minutes: number): number {
  return daylightEv100(minutes);
}

/**
 * Brillo absoluto del render: EV100 de un gris medio de 0,18 unidades de
 * render en esa escena y hora. Con esto, una luminancia L del render vale
 * EV100 = brillo + log2(L / 0,18).
 */
export function sceneBrightnessEv100(sceneId: SimulatorSceneId, minutes: number): number {
  const reference = sceneReferenceEv100(sceneId, minutes);
  return reference - (calibratedRenderLog2(sceneId, minutes) - Math.log2(MID_GREY));
}
