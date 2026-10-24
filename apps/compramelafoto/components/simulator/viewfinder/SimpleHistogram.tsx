"use client";

import { SCENE_RENDER_CALIBRATION } from "@/lib/simulator/camera-exposure";
import { useCameraStore } from "@/lib/simulator/camera-store";
import { histogramFromLuminance, type HistogramData } from "@/lib/simulator/histogram";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useEffect, useId, useMemo, useState } from "react";

const GRAPH_WIDTH = 160;
const GRAPH_HEIGHT = 52;
const SAMPLE_COUNT = 64;

/** Curva suave tipo área (spline cúbica entre muestras). */
function buildAreaPath(values: number[], width: number, height: number): string {
  const max = Math.max(...values, 0.001);
  const step = width / (values.length - 1);
  const baseline = height - 1;

  const points = values.map((value, index) => ({
    x: index * step,
    y: baseline - (value / max) * (height - 4),
  }));

  let path = `M 0 ${baseline} L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX.toFixed(2)} ${current.y.toFixed(2)}, ${midX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  path += ` L ${width} ${baseline} Z`;
  return path;
}

function buildStrokePath(values: number[], width: number, height: number): string {
  const max = Math.max(...values, 0.001);
  const step = width / (values.length - 1);
  const baseline = height - 1;

  const points = values.map((value, index) => ({
    x: index * step,
    y: baseline - (value / max) * (height - 4),
  }));

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX.toFixed(2)} ${current.y.toFixed(2)}, ${midX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

/** Cada cuánto se rehace (ms): el fotómetro lee la imagen cada ~120 ms. */
const REFRESH_MS = 200;

/**
 * Histograma de la imagen como el de la cámara: de negro (izquierda) a blanco
 * (derecha), ya con la exposición aplicada. Avisa si se queman las luces o se
 * empastan las sombras.
 */
export default function SimpleHistogram() {
  const { showHistogram } = useCameraStore();
  const gradientId = useId();
  const [data, setData] = useState<HistogramData | null>(null);

  useEffect(() => {
    if (!showHistogram) return;
    let lastGrid: unknown = null;
    const id = window.setInterval(() => {
      const grid = simulatorRuntime.meterGrid;
      if (!grid || grid.luminance === lastGrid) return;
      lastGrid = grid.luminance;
      // La imagen final multiplica por la ganancia de exposición (la del renderer
      // dividida por la calibración de la escena) y la curva ACES divide por 0,6.
      const gain = (simulatorRuntime.appliedToneMappingExposure ?? SCENE_RENDER_CALIBRATION) / SCENE_RENDER_CALIBRATION;
      const exposure = gain / 0.6;
      setData(histogramFromLuminance(grid.luminance, exposure, SAMPLE_COUNT));
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [showHistogram]);

  const values = data?.bins ?? new Array<number>(SAMPLE_COUNT).fill(0);
  const areaPath = useMemo(() => buildAreaPath(values, GRAPH_WIDTH, GRAPH_HEIGHT), [values]);
  const strokePath = useMemo(() => buildStrokePath(values, GRAPH_WIDTH, GRAPH_HEIGHT), [values]);

  if (!showHistogram) return null;
  const burnt = (data?.clippedHighlights ?? 0) > 0.02;
  const blocked = (data?.clippedShadows ?? 0) > 0.02;

  return (
    <div className="cod-vf-histogram" aria-label="Histograma de la imagen" role="img">
      <svg
        className="cod-vf-histogram__svg"
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.95)" />
            <stop offset="55%" stopColor="rgba(96, 165, 250, 0.72)" />
            <stop offset="100%" stopColor="rgba(224, 242, 254, 0.55)" />
          </linearGradient>
        </defs>
        <path className="cod-vf-histogram__area" d={areaPath} fill={`url(#${gradientId})`} />
        <path className="cod-vf-histogram__stroke" d={strokePath} />
        {blocked ? <rect x="0" y="0" width="3" height={GRAPH_HEIGHT} fill="#3b82f6" /> : null}
        {burnt ? <rect x={GRAPH_WIDTH - 3} y="0" width="3" height={GRAPH_HEIGHT} fill="#ef4444" /> : null}
      </svg>
    </div>
  );
}
