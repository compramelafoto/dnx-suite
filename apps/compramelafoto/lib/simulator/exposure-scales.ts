/**
 * Escalas fotográficas en tercios de paso.
 *
 * La cámara muestra números redondeados (f/5.6, 1/125, ISO 320) pero la luz
 * real es la del tercio exacto: f/5.6 es √2⁵ = 5,657 y 1/125 es 2⁻⁷ = 1/128.
 * Usar los nominales metía errores de hasta 0,1 EV entre pasos.
 */

import { APERTURE_PRESETS, ISO_PRESETS, SHUTTER_PRESETS } from "./camera-types";

const THIRD = 1 / 3;

/** Pasos de diafragma desde f/1 (f/1.4 = 1, f/2 = 2…), redondeado al tercio. */
export function apertureStops(fNumber: number): number {
  const stops = Math.log2(Math.max(0.5, fNumber) ** 2);
  return Math.round(stops / THIRD) * THIRD;
}

/** Número f exacto del tercio más cercano (f/5.6 → 5,657). */
export function exactAperture(fNumber: number): number {
  return Math.sqrt(2 ** apertureStops(fNumber));
}

/** Segundos exactos del tercio más cercano (1/125 → 1/128). */
export function exactShutterSeconds(seconds: number): number {
  const stops = Math.round(Math.log2(Math.max(1e-6, seconds)) / THIRD) * THIRD;
  return 2 ** stops;
}

/** ISO exacto del tercio más cercano respecto de 100 (ISO 320 → 317,5). */
export function exactIso(iso: number): number {
  const stops = Math.round(Math.log2(Math.max(1, iso) / 100) / THIRD) * THIRD;
  return 100 * 2 ** stops;
}

function isWholeStop(stops: number): boolean {
  return Math.abs(stops - Math.round(stops)) < 1e-6;
}

/** Marca de paso entero en la escala (las demás son tercios). */
export function isFullStopAperture(fNumber: number): boolean {
  return isWholeStop(apertureStops(fNumber));
}

export function isFullStopShutterSeconds(seconds: number): boolean {
  return isWholeStop(Math.log2(exactShutterSeconds(seconds)));
}

export function isFullStopIso(iso: number): boolean {
  return isWholeStop(Math.log2(exactIso(iso) / 100));
}

/** Diafragmas que permite un objetivo a la focal actual (de más abierto a más cerrado). */
export function aperturesForLens(maxOpen: number, minAperture: number): number[] {
  const open = apertureStops(maxOpen);
  const closed = apertureStops(minAperture);
  return APERTURE_PRESETS.filter((f) => {
    const s = apertureStops(f);
    return s >= open - 1e-6 && s <= closed + 1e-6;
  });
}

/** Lleva un diafragma al rango del objetivo, al tercio válido más cercano. */
export function clampApertureToLens(fNumber: number, maxOpen: number, minAperture: number): number {
  const allowed = aperturesForLens(maxOpen, minAperture);
  if (allowed.length === 0) return fNumber;
  const target = apertureStops(fNumber);
  return allowed.reduce((best, f) =>
    Math.abs(apertureStops(f) - target) < Math.abs(apertureStops(best) - target) ? f : best,
  );
}

export { APERTURE_PRESETS, ISO_PRESETS, SHUTTER_PRESETS };
