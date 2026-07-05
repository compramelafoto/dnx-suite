/**
 * Detección de zoom durante exposición larga.
 *
 * TODO: zoom blur radial real, acumulación con cambios de FOV, efecto preciso.
 */

export interface ZoomSample {
  timeMs: number;
  focalLengthMm: number;
}

export interface ZoomExposureResult {
  detected: boolean;
  zoomChangedDuringExposure: boolean;
  startFocalLength: number;
  endFocalLength: number;
}

const MIN_FOCAL_DELTA_MM = 3;

export function computeZoomDuringExposure(samples: ZoomSample[]): ZoomExposureResult {
  if (samples.length < 2) {
    const only = samples[0]?.focalLengthMm ?? 50;
    return {
      detected: false,
      zoomChangedDuringExposure: false,
      startFocalLength: only,
      endFocalLength: only,
    };
  }

  const startFocalLength = samples[0].focalLengthMm;
  const endFocalLength = samples[samples.length - 1].focalLengthMm;
  const delta = Math.abs(endFocalLength - startFocalLength);
  const detected = delta >= MIN_FOCAL_DELTA_MM;

  return {
    detected,
    zoomChangedDuringExposure: detected,
    startFocalLength,
    endFocalLength,
  };
}

export function buildZoomPedagogyNotes(result: ZoomExposureResult): string[] {
  if (!result.detected) return [];
  const dir = result.endFocalLength > result.startFocalLength ? "tele" : "angular";
  return [
    `Zoom durante exposición detectado (${result.startFocalLength}mm → ${result.endFocalLength}mm, más ${dir})`,
  ];
}
