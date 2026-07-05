"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  FOCUS_POINT_COUNT,
  FOCUS_ZONE_COUNT,
  focusPointIndexToNdc,
} from "@/lib/simulator/focus-math";
import type { FocusStatus } from "@/lib/simulator/focus-types";

function statusClass(status: FocusStatus, isFocusing: boolean): string {
  if (isFocusing || status === "SEARCHING") return "cod-af-area--searching";
  if (status === "FOCUS_OK" || status === "TRACKING") return "cod-af-area--ok";
  if (status === "NO_FOCUS") return "cod-af-area--fail";
  return "";
}

function ndcToPercent(ndcX: number, ndcY: number): { left: string; top: string } {
  return {
    left: `${((ndcX + 1) / 2) * 100}%`,
    top: `${((1 - ndcY) / 2) * 100}%`,
  };
}

/**
 * Puntos / zonas / área amplia de AF en el visor.
 */
export default function FocusAreaOverlay() {
  const { focus } = useCameraStore();
  const { focusAreaMode, activeFocusPointIndex, status, isFocusing } = focus;
  const stateClass = statusClass(status, isFocusing);

  if (focusAreaMode === "POINT") {
    return (
      <div className="cod-af-overlay cod-af-overlay--points" aria-hidden="true">
        {Array.from({ length: FOCUS_POINT_COUNT }, (_, index) => {
          const [nx, ny] = focusPointIndexToNdc(index);
          const pos = ndcToPercent(nx, ny);
          const active = index === activeFocusPointIndex;
          return (
            <div
              key={index}
              className={`cod-af-point${
                active
                  ? ` cod-af-point--active${stateClass ? ` ${stateClass}` : ""}`
                  : " cod-af-point--inactive"
              }`}
              style={{ left: pos.left, top: pos.top }}
            />
          );
        })}
      </div>
    );
  }

  if (focusAreaMode === "ZONE") {
    return (
      <div className="cod-af-overlay cod-af-overlay--zone" aria-hidden="true">
        <div className="cod-af-zone-grid">
          {Array.from({ length: FOCUS_ZONE_COUNT }, (_, index) => {
            const active = index === activeFocusPointIndex;
            return (
              <div
                key={index}
                className={`cod-af-zone-cell${active ? ` cod-af-zone-cell--active ${stateClass}` : ""}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const sub = activeFocusPointIndex % 3;
  const bracketClass =
    sub === 0 ? "cod-af-wide--center" : sub === 1 ? "cod-af-wide--left" : "cod-af-wide--right";

  return (
    <div className="cod-af-overlay" aria-hidden="true">
      <div className={`cod-af-wide ${bracketClass} ${stateClass}`}>
        <span className="cod-af-wide__corner cod-af-wide__corner--tl" />
        <span className="cod-af-wide__corner cod-af-wide__corner--tr" />
        <span className="cod-af-wide__corner cod-af-wide__corner--bl" />
        <span className="cod-af-wide__corner cod-af-wide__corner--br" />
      </div>
    </div>
  );
}
