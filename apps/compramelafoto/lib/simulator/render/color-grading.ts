/**
 * Color grading y LUT — preparado para fase posterior.
 * No aplica efectos todavía; define contrato para post-proceso fotográfico.
 */

export interface LutAssetRef {
  /** Ruta pública .cube o textura 3D LUT. */
  url: string | null;
  intensity: number;
}

export interface ColorGradingParams {
  /** Lift / gamma / gain simplificado (0 = neutro). */
  lift: number;
  gamma: number;
  gain: number;
  saturation: number;
  contrast: number;
  lut: LutAssetRef;
}

export const NEUTRAL_COLOR_GRADING: ColorGradingParams = {
  lift: 0,
  gamma: 1,
  gain: 1,
  saturation: 1,
  contrast: 1,
  lut: { url: null, intensity: 0 },
};

/** Contrato para shader/post futuro — sin implementación activa. */
export interface ColorGradingPassConfig {
  enabled: boolean;
  params: ColorGradingParams;
}

export function createColorGradingPassConfig(
  overrides?: Partial<ColorGradingParams>,
): ColorGradingPassConfig {
  return {
    enabled: false,
    params: { ...NEUTRAL_COLOR_GRADING, ...overrides },
  };
}
