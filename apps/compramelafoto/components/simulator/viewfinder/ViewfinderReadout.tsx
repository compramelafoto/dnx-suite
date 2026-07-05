"use client";

import { formatAperture, formatShutterSpeed, formatWhiteBalance } from "@/lib/simulator/camera-settings";
import { useCameraStore } from "@/lib/simulator/camera-store";

/**
 * Lectura inferior del visor — estilo DSLR/mirrorless.
 *
 * TODO (etapas futuras):
 * - Profundidad de campo y distancia de enfoque en readout
 * - Indicador de punto de enfoque seleccionable
 */
export default function ViewfinderReadout() {
  const { derived } = useCameraStore();
  const { effectiveSettings } = derived;

  return (
    <div className="cod-vf-readout">
      <span className="cod-vf-readout__mode">{effectiveSettings.mode}</span>
      <span className="cod-vf-readout__sep" aria-hidden="true" />
      <span>ISO {effectiveSettings.iso}</span>
      <span className="cod-vf-readout__sep" aria-hidden="true" />
      <span>{formatAperture(effectiveSettings.aperture)}</span>
      <span className="cod-vf-readout__sep" aria-hidden="true" />
      <span>{formatShutterSpeed(effectiveSettings.shutterSpeed)}</span>
      <span className="cod-vf-readout__sep" aria-hidden="true" />
      <span>WB {formatWhiteBalance(effectiveSettings.whiteBalance)}</span>
      <span className="cod-vf-readout__af" title="Enfoque único, punto central">
        AF-S · Centro
      </span>
    </div>
  );
}
