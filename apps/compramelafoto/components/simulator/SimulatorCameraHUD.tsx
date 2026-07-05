"use client";

import DslrViewfinderBar from "@/components/simulator/viewfinder/DslrViewfinderBar";
import CaptureFeedback from "@/components/simulator/viewfinder/CaptureFeedback";
import CompositionGuides from "@/components/simulator/viewfinder/CompositionGuides";
import FocusAreaOverlay from "@/components/simulator/viewfinder/FocusAreaOverlay";
import FocusIndicator from "@/components/simulator/viewfinder/FocusIndicator";
import SimpleHistogram from "@/components/simulator/viewfinder/SimpleHistogram";
import { COD_OBTURAR_EVENT, type CodObturarDetail } from "@/lib/simulator/shutter-sound";
import { useEffect, useState } from "react";

/**
 * Visor tipo cámara DSLR/mirrorless con readouts, fotómetro y guías.
 * El área central (`cod-hud__capture-frame`) coincide con la foto final.
 */
export default function SimulatorCameraHUD() {
  const [shutterOpen, setShutterOpen] = useState(false);

  useEffect(() => {
    const onObturar = (event: Event) => {
      const { durationMs } = (event as CustomEvent<CodObturarDetail>).detail;
      setShutterOpen(true);
      window.setTimeout(() => setShutterOpen(false), durationMs);
    };

    window.addEventListener(COD_OBTURAR_EVENT, onObturar);
    return () => window.removeEventListener(COD_OBTURAR_EVENT, onObturar);
  }, []);

  return (
    <div className="cod-hud" aria-hidden="true">
      <div className="cod-hud__capture-frame">
        <FocusAreaOverlay />
        <FocusIndicator />

        <div className="cod-hud__corners">
          <span className="cod-hud__corner cod-hud__corner--tl" />
          <span className="cod-hud__corner cod-hud__corner--tr" />
          <span className="cod-hud__corner cod-hud__corner--bl" />
          <span className="cod-hud__corner cod-hud__corner--br" />
        </div>

        <CompositionGuides />
        <div className="cod-hud__level" />

        <div className="cod-hud__focus">
          <div className="cod-hud__focus-ring" />
          <span className="cod-hud__focus-cross-h" />
          <span className="cod-hud__focus-cross-v" />
        </div>

        <SimpleHistogram />
        <CaptureFeedback />
      </div>

      <div className="cod-hud__margin-bottom">
        <div className={`cod-hud__shutter${shutterOpen ? " cod-hud__shutter--open" : ""}`}>
          <span className={`cod-hud__shutter-dot${shutterOpen ? " cod-hud__shutter-dot--open" : ""}`} />
          {shutterOpen ? "Obturando…" : "Espacio — Obturar"}
        </div>

        <div className="cod-hud__bottom">
          <DslrViewfinderBar />
        </div>
      </div>
    </div>
  );
}
