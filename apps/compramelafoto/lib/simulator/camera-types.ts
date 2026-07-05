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

/** ISO en pasos de luz enteros desde 100 (×2 = +1 EV por paso). */
export const ISO_PRESETS = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600] as const;

/** Multiplicador de exposición de cada ISO respecto a ISO 100 (para validación). */
export const ISO_EXPOSURE_FROM_100: Record<(typeof ISO_PRESETS)[number], number> = {
  100: 1,
  200: 2,
  400: 4,
  800: 8,
  1600: 16,
  3200: 32,
  6400: 64,
  12800: 128,
  25600: 256,
};

/**
 * Tiempo de exposición en pasos de luz enteros (×2 por paso = +1 EV).
 * Corto: 1/4000 s — largo: 8 s.
 */
export const SHUTTER_PRESETS = [
  "1/4000",
  "1/2000",
  "1/1000",
  "1/500",
  "1/250",
  "1/125",
  "1/60",
  "1/30",
  "1/15",
  "1/8",
  "1/4",
  "1/2",
  '1"',
  '2"',
  '4"',
  '8"',
] as const;

/** Diafragma en pasos de luz enteros hasta f/22. */
export const APERTURE_PRESETS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22] as const;

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

/** Segundos equivalentes de cada preset de obturador (para validación / tests). */
export const SHUTTER_PRESET_SECONDS: Record<(typeof SHUTTER_PRESETS)[number], number> = {
  "1/4000": 1 / 4000,
  "1/2000": 1 / 2000,
  "1/1000": 1 / 1000,
  "1/500": 1 / 500,
  "1/250": 1 / 250,
  "1/125": 1 / 125,
  "1/60": 1 / 60,
  "1/30": 1 / 30,
  "1/15": 1 / 15,
  "1/8": 1 / 8,
  "1/4": 1 / 4,
  "1/2": 1 / 2,
  '1"': 1,
  '2"': 2,
  '4"': 4,
  '8"': 8,
};
