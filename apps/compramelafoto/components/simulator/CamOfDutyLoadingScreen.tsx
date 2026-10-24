"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import { loadingGate, loadingPercent } from "@/lib/simulator/loading-gate";

/** Lo que se cuenta mientras sube la barra. */
function stageText(percent: number): string {
  if (percent < 30) return "Bajando la ciudad…";
  if (percent < 60) return "Vistiendo a la gente…";
  if (percent < 85) return "Estacionando los autos…";
  if (percent < 100) return "Calibrando la cámara…";
  return "¡Listo!";
}

/**
 * Pantalla de carga de los simuladores: logo y barra a pantalla completa hasta
 * que la escena está entera. Tapa y bloquea todo; recién al 100 % se desvanece.
 */
export default function CamOfDutyLoadingScreen({ stage }: { stage?: (percent: number) => string }) {
  const snapshot = useSyncExternalStore(loadingGate.subscribe, loadingGate.getSnapshot, loadingGate.getSnapshot);
  // La barra nunca retrocede, aunque aparezcan archivos nuevos por pedir.
  const shown = useRef(0);
  const percent = Math.max(shown.current, loadingPercent(snapshot));
  shown.current = percent;

  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!snapshot.ready) {
      setGone(false);
      return;
    }
    const t = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(t);
  }, [snapshot.ready]);

  if (gone) return null;
  return (
    <div
      className={`cod-loading${snapshot.ready ? " cod-loading--done" : ""}`}
      role="progressbar"
      aria-label="Cargando el simulador"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <CamOfDutyLogo variant="hero" transparent className="cod-loading__logo" />
      <div className="cod-loading__bar" aria-hidden="true">
        <div className="cod-loading__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="cod-loading__text">
        <span className="cod-loading__percent">{percent}%</span>
        <span>{(stage ?? stageText)(percent)}</span>
      </p>
    </div>
  );
}
