/**
 * Cam Of Duty — utilidades de formato para la UI de cámara.
 */

import type { CameraMode } from "./camera-types";

/** @deprecated Usar REFERENCE_CAMERA de camera-types.ts */
export { REFERENCE_CAMERA as DEMO_CAMERA_SETTINGS } from "./camera-types";

/** Etiquetas UI — Cam Of Duty (terminología pedagógica). */
export const UI_LABEL_EXPOSURE_TIME = "Tiempo de exposición";
export const UI_LABEL_EXPOSURE_TIME_AUTO = "Tiempo de exposición (auto)";

/** Formatea el diafragma para display (ej. f/2.8, f/22). */
export function formatAperture(fStop: number): string {
  const rounded = Math.round(fStop * 10) / 10;
  return `f/${rounded}`;
}

/** Diafragma en visor óptico DSLR (ej. 2.8, 9.0 — sin prefijo f/). */
export function formatApertureForViewfinder(fStop: number): string {
  const rounded = Math.round(fStop * 10) / 10;
  return rounded.toFixed(1);
}

/** Formatea el tiempo de exposición para HUD y panel. */
export function formatShutterSpeed(shutterSpeed: string): string {
  return shutterSpeed;
}

/**
 * Tiempo de exposición en LCD del visor óptico (ej. 1/250 → "250", 2" → "2").
 * En UI pedagógica siempre es tiempo de exposición, no "velocidad de obturación".
 */
export function formatShutterForViewfinder(shutterSpeed: string): string {
  const trimmed = shutterSpeed.trim();
  const fraction = trimmed.match(/^1\/(\d+)$/);
  if (fraction) return fraction[1];
  const quoted = trimmed.match(/^(\d+(?:\.\d+)?)"/);
  if (quoted) return quoted[1];
  return trimmed;
}

/** Formatea distancia focal para HUD (ej. 50 mm). */
export function formatFocalLength(mm: number): string {
  return `${mm} mm`;
}

/** Formatea el balance de blancos para display (ej. 5600K). */
export function formatWhiteBalance(kelvin: number): string {
  return `${kelvin}K`;
}

export const MODE_UI_TITLES: Record<CameraMode, string> = {
  M: "Manual — controlás ISO, tiempo de exposición y diafragma",
  A: "Prioridad apertura — elegís diafragma; el tiempo de exposición es automático",
  S: "Prioridad tiempo de exposición — elegís el tiempo; el diafragma es automático",
};

/** Formatea el modo de exposición para display. */
export function formatExposureMode(mode: CameraMode): string {
  const labels: Record<CameraMode, string> = {
    M: "Manual",
    A: "Prioridad Apertura",
    S: "Prioridad tiempo de exposición",
  };
  return labels[mode];
}
