"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { areaHudLabel } from "@/lib/simulator/focus-math";
import { focusModeToLabel, focusStatusToLabel } from "@/lib/simulator/focus-types";
import { useEffect, useState } from "react";

const PULSE_MS = 1800;

/**
 * Readout de enfoque: modo · área · distancia · estado.
 */
export default function FocusIndicator() {
  const { focus } = useCameraStore();
  const [pulse, setPulse] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!focus.lockedAtMs) return;
    setPulse(true);
    const label =
      focus.status === "NO_FOCUS"
        ? "Sin foco en el área"
        : `Foco confirmado ${focus.distanceM.toFixed(1)} m`;
    setToast(label);
    const pulseTimer = window.setTimeout(() => setPulse(false), PULSE_MS);
    const toastTimer = window.setTimeout(() => setToast(null), 2400);
    return () => {
      window.clearTimeout(pulseTimer);
      window.clearTimeout(toastTimer);
    };
  }, [focus.lockedAtMs, focus.distanceM, focus.status]);

  useEffect(() => {
    if (!focus.areaFeedback) return;
    setToast(focus.areaFeedback);
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focus.areaFeedback]);

  const modeLabel = focusModeToLabel(focus.focusMode);
  const areaLabel = areaHudLabel(focus.focusAreaMode, focus.activeFocusPointIndex);
  const statusLabel = focus.isFocusing
    ? "BUSCANDO"
    : focusStatusToLabel(focus.status) || (focus.focusMode === "MF" ? "MANUAL" : "");

  const readoutClass = [
    "cod-vf-focus-readout",
    pulse ? "cod-vf-focus-readout--pulse" : "",
    focus.isFocusing || focus.status === "SEARCHING" ? "cod-vf-focus-readout--searching" : "",
    focus.status === "FOCUS_OK" || focus.status === "TRACKING"
      ? "cod-vf-focus-readout--ok"
      : "",
    focus.status === "NO_FOCUS" ? "cod-vf-focus-readout--fail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        className={readoutClass}
        role="status"
        aria-live="polite"
        aria-label={`Enfoque ${modeLabel}, área ${areaLabel}, ${focus.distanceM} metros, ${statusLabel}`}
      >
        <span className="cod-vf-focus-readout__mode">{modeLabel}</span>
        <span className="cod-vf-focus-readout__sep">·</span>
        <span className="cod-vf-focus-readout__area">{areaLabel}</span>
        <span className="cod-vf-focus-readout__sep">·</span>
        <span className="cod-vf-focus-readout__dist">{focus.distanceM.toFixed(1)} m</span>
        {statusLabel ? (
          <>
            <span className="cod-vf-focus-readout__sep">·</span>
            <span className="cod-vf-focus-readout__status">{statusLabel}</span>
          </>
        ) : null}
      </div>

      {toast ? (
        <div className="cod-vf-focus-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </>
  );
}
