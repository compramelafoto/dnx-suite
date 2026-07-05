"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { useId, useMemo } from "react";

const GRAPH_WIDTH = 160;
const GRAPH_HEIGHT = 52;
const SAMPLE_COUNT = 96;

function buildSmoothValues(bias: number): number[] {
  const center = SAMPLE_COUNT * 0.5 + bias * SAMPLE_COUNT * 0.34;
  const spread = bias < -0.3 ? 9 : bias > 0.3 ? 15 : 12;

  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const dist = (i - center) / spread;
    const core = Math.exp(-0.5 * dist * dist);
    const shoulder = Math.exp(-0.5 * ((i - center * 0.72) / (spread * 1.6)) ** 2) * 0.18;
    return Math.min(1, core + shoulder);
  });
}

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

/**
 * Histograma pedagógico simplificado según exposición medida.
 */
export default function SimpleHistogram() {
  const { derived, showHistogram } = useCameraStore();
  const { histogramBias } = derived;
  const gradientId = useId();

  const values = useMemo(() => buildSmoothValues(histogramBias), [histogramBias]);
  const areaPath = useMemo(
    () => buildAreaPath(values, GRAPH_WIDTH, GRAPH_HEIGHT),
    [values],
  );
  const strokePath = useMemo(
    () => buildStrokePath(values, GRAPH_WIDTH, GRAPH_HEIGHT),
    [values],
  );

  if (!showHistogram) return null;

  return (
    <div className="cod-vf-histogram" aria-label="Histograma simplificado" role="img">
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
      </svg>
    </div>
  );
}
