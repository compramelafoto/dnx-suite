/**
 * Tipos y presets de la cámara simulada — Cam Of Duty.
 * Todos los presets de exposición usan pasos de luz enteros (1 EV).
 */

import type { ExposureDebugSnapshot } from "./camera-exposure";

/** Modos de exposición simplificados (M / A / S). */
export type CameraMode = "M" | "A" | "S";

/** Estado editable de la cámara en el simulador. */
export interface CameraState {
  iso: number;
  shutterSpeed: string;
  aperture: number;
  /** Distancia focal en milímetros (afecta profundidad de campo). */
  focalLengthMm: number;
  whiteBalance: number;
  exposureCompensation: number;
  mode: CameraMode;
  /**
   * Diafragmas que permite el objetivo montado a la focal actual.
   * Los modos A/S no salen de este tramo, como en la cámara.
   */
  apertureRange?: { maxOpen: number; minAperture: number };
}

/** Veredicto de exposición de una captura. */
export type ExposureVerdict = "under" | "correct" | "over";

/** Valores derivados para render y HUD. */
export interface CameraDerivedValues {
  /** Ajustes tras auto-exposición en modos A / S. */
  effectiveSettings: CameraState;
  /** Multiplicador de vista previa (LIVE VIEW o DSLR VIEW). */
  previewExposureMultiplier: number;
  /** Multiplicador de la foto capturada (sin compensación en M). */
  photoExposureMultiplier: number;
  /** Multiplicador por fotograma (sin tiempo de obturación) para acumulación. */
  instantPhotoExposureMultiplier: number;
  /** EV medido vs escena (positivo = sobreexpuesto). */
  measuredEv: number;
  /** Posición de la aguja en escala -3…+3 (resta compensación). */
  meterNeedleEv: number;
  exposureVerdict: ExposureVerdict;
  evLabel: string;
  captureEvLabel: string;
  wbTint: { r: number; g: number; b: number };
  /** Sesgo -1…1 para histograma pedagógico. */
  histogramBias: number;
  /** @deprecated Usar previewExposureMultiplier */
  exposureMultiplier: number;
  /** @deprecated Usar meterNeedleEv */
  exposureValue: number;
  /** Snapshot de depuración (solo desarrollo). */
  exposureDebug: ExposureDebugSnapshot;
}

/**
 * Escalas en tercios de paso, como vienen configuradas las cámaras.
 * Los números son los nominales que imprime la cámara; para la cuenta de luz
 * se usa el valor exacto del tercio (ver exposure-scales.ts).
 */
export const ISO_PRESETS = [
  100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000,
  5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600,
] as const;

/** Tiempo de exposición en tercios: corto 1/8000 s — largo 30 s. */
export const SHUTTER_PRESETS = [
  "1/8000", "1/6400", "1/5000", "1/4000", "1/3200", "1/2500", "1/2000", "1/1600", "1/1250",
  "1/1000", "1/800", "1/640", "1/500", "1/400", "1/320", "1/250", "1/200", "1/160", "1/125",
  "1/100", "1/80", "1/60", "1/50", "1/40", "1/30", "1/25", "1/20", "1/15", "1/13", "1/10",
  "1/8", "1/6", "1/5", "1/4", '0.3"', '0.4"', '0.5"', '0.6"', '0.8"', '1"', '1.3"', '1.6"',
  '2"', '2.5"', '3.2"', '4"', '5"', '6"', '8"', '10"', '13"', '15"', '20"', '25"', '30"',
] as const;

/** Diafragma en tercios de f/1.4 a f/32. Cada objetivo usa sólo su tramo. */
export const APERTURE_PRESETS = [
  1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16,
  18, 20, 22, 25, 29, 32,
] as const;

/** Distancias focales pedagógicas (mm). */
export const FOCAL_LENGTH_PRESETS = [24, 35, 50, 85, 135, 200] as const;
export type FocalLengthMm = (typeof FOCAL_LENGTH_PRESETS)[number];
export const DEFAULT_FOCAL_LENGTH_MM: FocalLengthMm = 50;

export const WB_PRESETS = [3200, 4500, 5600, 6500, 7500] as const;

export const MODE_PRESETS: readonly CameraMode[] = ["M", "A", "S"];

/** Referencia pedagógica para EV 0 en la escena de entrenamiento. */
export const REFERENCE_CAMERA: CameraState = {
  iso: 400,
  shutterSpeed: "1/250",
  aperture: 2.8,
  focalLengthMm: 50,
  whiteBalance: 5600,
  exposureCompensation: 0,
  mode: "M",
};

