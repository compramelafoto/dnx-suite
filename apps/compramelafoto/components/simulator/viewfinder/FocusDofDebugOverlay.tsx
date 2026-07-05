"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  calculateDepthOfFieldLimits,
  formatFarDofLimit,
} from "@/lib/simulator/depth-of-field";
import { useEffect, useState } from "react";

const SHOW_DOF_DEBUG =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_COD_DOF_DEBUG === "true";

/**
 * Overlay de desarrollo: plano de enfoque, límites DOF e hiperfocal.
 * Activar con NEXT_PUBLIC_COD_DOF_DEBUG=true
 */
export default function FocusDofDebugOverlay() {
  const { focus, settings, derived } = useCameraStore();
  const [visible, setVisible] = useState(SHOW_DOF_DEBUG);

  useEffect(() => {
    if (!SHOW_DOF_DEBUG) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const aperture = derived.effectiveSettings.aperture;
  const focalLengthMm = settings.focalLengthMm;
  const focusDistanceM = focus.distanceM;

  const limits = calculateDepthOfFieldLimits({
    focusDistanceM,
    focalLengthMm,
    aperture,
  });

  return (
    <div className="cod-dof-debug" aria-hidden="true">
      <p className="cod-dof-debug__title">DOF debug</p>
      <dl className="cod-dof-debug__list">
        <div>
          <dt>Focus</dt>
          <dd>{focusDistanceM.toFixed(2)} m</dd>
        </div>
        <div>
          <dt>Near</dt>
          <dd>{limits.nearLimitM.toFixed(2)} m</dd>
        </div>
        <div>
          <dt>Far</dt>
          <dd>{formatFarDofLimit(limits.farLimitM)}</dd>
        </div>
        <div>
          <dt>H</dt>
          <dd>{limits.hyperfocalM.toFixed(1)} m</dd>
        </div>
        <div>
          <dt>Focal</dt>
          <dd>{focalLengthMm} mm</dd>
        </div>
        <div>
          <dt>Aperture</dt>
          <dd>f/{aperture}</dd>
        </div>
      </dl>
    </div>
  );
}
