/**
 * @deprecated Usar camera-math.ts
 *
 * TODO (etapas futuras):
 * - Ruido digital por ISO elevado
 * - Histograma de luminancia
 * - Retroalimentación visual (sobre/subexpuesto)
 */

export {
  shutterSpeedToSeconds,
  computeRawExposureMultiplier,
  computeExposureMultiplier,
  computeExposureValue,
  formatEvLabel,
} from "./camera-math";

import { computeExposureValue } from "./camera-math";
import type { CameraState } from "./camera-types";

/** @deprecated Usar computeExposureValue */
export function calculateExposureValue(settings: CameraState): number {
  return computeExposureValue(settings);
}
