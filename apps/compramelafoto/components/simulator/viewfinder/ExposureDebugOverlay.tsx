"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useEffect, useState } from "react";

const SHOW_EXPOSURE_DEBUG =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_COD_EXPOSURE_DEBUG === "true";

/**
 * Panel de depuración de exposición (solo desarrollo).
 * Activar con NEXT_PUBLIC_COD_EXPOSURE_DEBUG=true
 */
export default function ExposureDebugOverlay() {
  const { derived, viewfinderMode, sceneLuminanceEv } = useCameraStore();
  const [visible, setVisible] = useState(SHOW_EXPOSURE_DEBUG);
  const [applied, setApplied] = useState<number | null>(null);

  useEffect(() => {
    if (!SHOW_EXPOSURE_DEBUG) return;
    setVisible(true);
    const id = window.setInterval(() => {
      setApplied(simulatorRuntime.appliedToneMappingExposure);
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  if (!visible) return null;

  const d = derived.exposureDebug;
  const fmt = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : "—");

  return (
    <div className="cod-exposure-debug" aria-hidden="true">
      <p className="cod-exposure-debug__title">Exposición (dev)</p>
      <dl className="cod-exposure-debug__list">
        <div>
          <dt>Modo visor</dt>
          <dd>{viewfinderMode === "live-view" ? "LIVE VIEW" : "DSLR VIEW"}</dd>
        </div>
        <div>
          <dt>Modo cámara</dt>
          <dd>{d.mode}</dd>
        </div>
        <div>
          <dt>ISO</dt>
          <dd>{d.iso}</dd>
        </div>
        <div>
          <dt>Tiempo de exposición</dt>
          <dd>
            {d.shutterSpeed} ({fmt(d.shutterSeconds, 4)} s)
          </dd>
        </div>
        <div>
          <dt>Diafragma</dt>
          <dd>f/{d.aperture}</dd>
        </div>
        <div>
          <dt>EV100</dt>
          <dd>{fmt(d.ev100)}</dd>
        </div>
        <div>
          <dt>EV (ISO adj.)</dt>
          <dd>{fmt(d.exposureEv)}</dd>
        </div>
        <div>
          <dt>EV referencia</dt>
          <dd>{fmt(d.referenceExposureEv)}</dd>
        </div>
        <div>
          <dt>sceneLuminanceEv</dt>
          <dd>{fmt(sceneLuminanceEv)}</dd>
        </div>
        <div>
          <dt>meterEv (foto)</dt>
          <dd>{fmt(d.measuredEv)}</dd>
        </div>
        <div>
          <dt>Aguja fotómetro</dt>
          <dd>{fmt(d.meterNeedleEv)}</dd>
        </div>
        <div>
          <dt>Pasos vs ref.</dt>
          <dd>{fmt(d.relativeStops)}</dd>
        </div>
        <div>
          <dt>Factor escena 2^S</dt>
          <dd>{fmt(d.sceneBrightnessFactor)}</dd>
        </div>
        <div>
          <dt>previewMultiplier</dt>
          <dd>{fmt(d.previewExposureMultiplier)}</dd>
        </div>
        <div>
          <dt>photoMultiplier</dt>
          <dd>{fmt(d.photoExposureMultiplier)}</dd>
        </div>
        <div>
          <dt>toneMappingExposure</dt>
          <dd>{applied != null ? fmt(applied) : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
