/**
 * Intensidades de escena por slot HDRI — Ciudad Fotográfica.
 * Complementa la luz direccional sin ambientLight genérico.
 */

import type { HdriTimeSlot } from "./hdri-time-of-day";

export interface HdriSceneApplyConfig {
  environmentIntensity: number;
  backgroundIntensity: number;
  /** Usar textura equirectangular como fondo (además de IBL). */
  useBackground: boolean;
  /** Escala de intensidad del sol direccional (IBL ya aporta relleno). */
  sunIntensityScale: number;
  /** Tinte solar opcional para alinear con HDRI. */
  sunColorOverride: string | null;
}

const DEFAULT_CONFIG: HdriSceneApplyConfig = {
  environmentIntensity: 1,
  backgroundIntensity: 0.85,
  useBackground: true,
  sunIntensityScale: 0.8,
  sunColorOverride: null,
};

const SLOT_CONFIG: Partial<Record<HdriTimeSlot, Partial<HdriSceneApplyConfig>>> = {
  noon: {
    environmentIntensity: 1,
    backgroundIntensity: 0.88,
    useBackground: true,
    sunIntensityScale: 0.72,
    sunColorOverride: "#fffaf5",
  },
  morning: {
    environmentIntensity: 0.95,
    backgroundIntensity: 0.82,
    sunIntensityScale: 0.85,
    sunColorOverride: "#ffe8d0",
  },
  "golden-hour": {
    environmentIntensity: 0.9,
    backgroundIntensity: 0.9,
    sunIntensityScale: 0.9,
    sunColorOverride: "#ffd4a0",
  },
  "blue-hour": {
    environmentIntensity: 0.75,
    backgroundIntensity: 0.7,
    sunIntensityScale: 0.35,
    sunColorOverride: "#a8c0e8",
  },
  night: {
    environmentIntensity: 0.55,
    backgroundIntensity: 0.5,
    sunIntensityScale: 0.05,
    sunColorOverride: "#8090b0",
  },
};

export function resolveHdriSceneConfig(slot: HdriTimeSlot): HdriSceneApplyConfig {
  return { ...DEFAULT_CONFIG, ...SLOT_CONFIG[slot] };
}
