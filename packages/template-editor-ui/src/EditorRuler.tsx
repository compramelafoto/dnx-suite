"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

/** Grosor de las reglas, en px de pantalla. */
export const RULER_SIZE_PX = 18;

const MM_PER_INCH = 25.4;
/** Pasos posibles entre números de la regla, en la unidad mostrada. */
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
/** Separación mínima entre dos números de la regla, en px de pantalla. */
const MIN_LABEL_GAP_PX = 56;

/**
 * Regla al estilo de Photoshop. Mide en milímetros cuando la plantilla tiene DPI (es lo que usa
 * quien diseña para imprimir) y en píxeles si no. El cero coincide con el borde de la hoja y la
 * regla se corre con el scroll y el zoom.
 *
 * Arrastrar desde la regla saca una guía: la regla de arriba da guías horizontales y la de la
 * izquierda, verticales.
 */
export function EditorRuler({
  orientation,
  lengthPx,
  originPx,
  zoom,
  dpi,
  onPointerDown,
}: {
  orientation: "horizontal" | "vertical";
  /** Largo visible de la regla, px de pantalla. */
  lengthPx: number;
  /** Dónde cae el 0 de la hoja dentro de la regla, px de pantalla. */
  originPx: number;
  zoom: number;
  dpi: number | null | undefined;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const horizontal = orientation === "horizontal";
  const canvasPxPerUnit = dpi && dpi > 0 ? dpi / MM_PER_INCH : 1;
  const screenPerUnit = canvasPxPerUnit * (zoom > 0 ? zoom : 1);
  const step = NICE_STEPS.find((s) => s * screenPerUnit >= MIN_LABEL_GAP_PX) ?? NICE_STEPS[NICE_STEPS.length - 1]!;
  const minor = step / (step % 5 === 0 ? 5 : 2);

  const ticks: { pos: number; major: boolean; label?: string }[] = [];
  if (lengthPx > 0 && screenPerUnit > 0) {
    const first = Math.floor(-originPx / screenPerUnit / minor) * minor;
    const last = (lengthPx - originPx) / screenPerUnit;
    for (let u = first; u <= last; u += minor) {
      const v = Math.round(u * 1000) / 1000;
      const pos = originPx + v * screenPerUnit;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      ticks.push({ pos, major, label: major ? String(Math.round(v)) : undefined });
    }
  }

  return (
    <div
      className={
        horizontal
          ? "relative h-full min-w-0 flex-1 cursor-row-resize select-none overflow-hidden border-b border-[color:var(--te-line)] bg-[color:var(--te-chrome)]"
          : "relative h-full w-full cursor-col-resize select-none overflow-hidden border-r border-[color:var(--te-line)] bg-[color:var(--te-chrome)]"
      }
      title={horizontal ? "Arrastrá hacia la hoja para crear una guía horizontal" : "Arrastrá hacia la hoja para crear una guía vertical"}
      onPointerDown={onPointerDown}
      aria-label={horizontal ? "Regla horizontal" : "Regla vertical"}
      role="presentation"
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {ticks.map((t, i) => {
          const len = t.major ? RULER_SIZE_PX : RULER_SIZE_PX * 0.3;
          return horizontal ? (
            <g key={i}>
              <line
                x1={t.pos}
                x2={t.pos}
                y1={RULER_SIZE_PX - len}
                y2={RULER_SIZE_PX}
                stroke="var(--te-ink-faint)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              {t.label ? (
                <text x={t.pos + 3} y={9} fontSize={9} fill="var(--te-ink-muted)">
                  {t.label}
                </text>
              ) : null}
            </g>
          ) : (
            <g key={i}>
              <line
                y1={t.pos}
                y2={t.pos}
                x1={RULER_SIZE_PX - len}
                x2={RULER_SIZE_PX}
                stroke="var(--te-ink-faint)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              {t.label ? (
                <text
                  x={9}
                  y={t.pos + 3}
                  fontSize={9}
                  fill="var(--te-ink-muted)"
                  transform={`rotate(-90 9 ${t.pos + 3})`}
                  textAnchor="end"
                >
                  {t.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
