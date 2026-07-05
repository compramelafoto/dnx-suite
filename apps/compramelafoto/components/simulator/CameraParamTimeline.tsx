"use client";

import { formatAperture, formatShutterSpeed, formatWhiteBalance } from "@/lib/simulator/camera-settings";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useCallback, useRef } from "react";

export const PARAM_RESET_TOOLTIP = "Doble click para restaurar";

export type CameraTimelineVariant = "iso" | "shutter" | "aperture" | "focal" | "wb" | "mode" | "comp" | "viewfinder" | "guides" | "histogram";

function defaultCompare<T>(a: T, b: T): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Number.isInteger(a) ? a === b : Math.abs(a - b) < 0.01;
  }
  return a === b;
}

function findOptionIndex<T>(
  options: readonly T[],
  value: T,
  compare: (a: T, b: T) => boolean,
): number {
  const idx = options.findIndex((opt) => compare(opt, value));
  return idx >= 0 ? idx : 0;
}

function stopPosition(index: number, count: number): number {
  if (count <= 1) return 50;
  return (index / (count - 1)) * 100;
}

/** Mapea índice de preset a posición visual (desc = largo a la izquierda). */
function indexToVisualPercent(
  index: number,
  count: number,
  scaleDirection: "asc" | "desc",
): number {
  if (scaleDirection === "desc") {
    return stopPosition(count - 1 - index, count);
  }
  return stopPosition(index, count);
}

/** Convierte posición horizontal del click a índice de preset. */
function ratioToIndex(ratio: number, count: number, scaleDirection: "asc" | "desc"): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  const ascIndex = Math.round(clamped * (count - 1));
  if (scaleDirection === "desc") {
    return count - 1 - ascIndex;
  }
  return ascIndex;
}

interface CameraParamTimelineProps<T extends string | number> {
  id: string;
  label: string;
  variant: CameraTimelineVariant;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  formatValue: (value: T) => string;
  compare?: (a: T, b: T) => boolean;
  /** asc: menor→izq; desc: mayor→izq (tiempo de exposición: largo a corto). */
  scaleDirection?: "asc" | "desc";
  focused?: boolean;
  readOnly?: boolean;
  resettable?: boolean;
  onReset?: () => void;
}

/**
 * Línea de tiempo con divisiones por paso de luz (un preset = un stop).
 */
export default function CameraParamTimeline<T extends string | number>({
  id,
  label,
  variant,
  value,
  options,
  onChange,
  formatValue,
  compare = defaultCompare,
  scaleDirection = "asc",
  focused = false,
  readOnly = false,
  resettable = false,
  onReset,
}: CameraParamTimelineProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const index = findOptionIndex(options, value, compare);
  const progress = indexToVisualPercent(index, options.length, scaleDirection);

  const snapToClientX = useCallback(
    (clientX: number) => {
      if (readOnly) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const targetIndex = ratioToIndex(ratio, options.length, scaleDirection);
      if (targetIndex !== index) onChange(options[targetIndex]);
    },
    [index, onChange, options, readOnly, scaleDirection],
  );

  const step = (delta: -1 | 1) => {
    if (readOnly) return;
    const arrayDelta = scaleDirection === "desc" ? ((-delta) as -1 | 1) : delta;
    const next = index + arrayDelta;
    if (next < 0 || next >= options.length) return;
    onChange(options[next]);
  };

  const onTrackClick = (event: MouseEvent<HTMLDivElement>) => {
    snapToClientX(event.clientX);
  };

  const onTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    snapToClientX(event.clientX);
  };

  const onTrackPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || readOnly) return;
    snapToClientX(event.clientX);
  };

  const onTrackPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onTrackKeyDown = (event: KeyboardEvent) => {
    if (readOnly) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      step(-1);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      step(1);
    }
  };

  const onDoubleClick = () => {
    if (!resettable || readOnly || !onReset) return;
    onReset();
  };

  const showEdgeLabels = options.length > 1;

  return (
    <div
      className={`cod-param-row cod-param-row--${variant}${focused ? " cod-param-row--focused" : ""}${readOnly ? " cod-param-row--readonly" : ""}`}
      title={resettable && !readOnly ? PARAM_RESET_TOOLTIP : undefined}
      onDoubleClick={onDoubleClick}
    >
      <div className="cod-param-row__head">
        <span className="cod-param-row__label" id={`${id}-label`}>
          {label}
        </span>
        <output className="cod-param-row__value" id={id}>
          {formatValue(value)}
        </output>
      </div>

      <div
        ref={trackRef}
        className={`cod-param-row__track cod-param-row__track--${variant}`}
        role="slider"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={options.length - 1}
        aria-valuenow={index}
        aria-valuetext={formatValue(value)}
        aria-disabled={readOnly || undefined}
        tabIndex={readOnly ? -1 : 0}
        onClick={onTrackClick}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        onKeyDown={onTrackKeyDown}
      >
        <span className="cod-param-row__track-rail" aria-hidden="true">
          <span className="cod-param-row__track-baseline" />
          <span className="cod-param-row__track-fill" style={{ width: `${progress}%` }} />
          <span className="cod-param-row__ticks">
            {options.map((option, tickIndex) => {
              const left = indexToVisualPercent(tickIndex, options.length, scaleDirection);
              const isActive = tickIndex === index;
              const isPassed = left <= progress;
              return (
                <span
                  key={`${String(option)}-${tickIndex}`}
                  className={`cod-param-row__tick${isActive ? " cod-param-row__tick--active" : ""}${isPassed ? " cod-param-row__tick--passed" : ""}`}
                  style={{ left: `${left}%` }}
                  title={formatValue(option)}
                />
              );
            })}
          </span>
          <span className="cod-param-row__track-thumb" style={{ left: `${progress}%` }} />
        </span>

        {showEdgeLabels ? (
          <span className="cod-param-row__edge-labels" aria-hidden="true">
            <span className="cod-param-row__edge-label cod-param-row__edge-label--min">
              {formatValue(
                scaleDirection === "desc" ? options[options.length - 1] : options[0],
              )}
            </span>
            <span className="cod-param-row__edge-label cod-param-row__edge-label--max">
              {formatValue(
                scaleDirection === "desc" ? options[0] : options[options.length - 1],
              )}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { formatAperture, formatShutterSpeed, formatWhiteBalance };
