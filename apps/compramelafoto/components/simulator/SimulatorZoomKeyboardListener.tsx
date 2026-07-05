"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { isSimulatorPointerLocked } from "@/lib/simulator/simulator-nav-surface";
import { useCallback, useEffect, useRef, useState } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Zoom con teclado cuando no hay Pointer Lock:
 * X = zoom out (más angular), Z = zoom in (más tele).
 * A conserva movimiento lateral (WASD). Alternativa: `[` / `]`.
 */
export default function SimulatorZoomKeyboardListener() {
  const { lens, stepLensZoom } = useCameraStore();
  const lensRef = useRef(lens);
  lensRef.current = lens;
  const stepRef = useRef(stepLensZoom);
  stepRef.current = stepLensZoom;
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 1600);
  }, []);

  const tryZoom = useCallback(
    (delta: -1 | 1) => {
      if (!lensRef.current.isZoomLens) {
        showFeedback("Objetivo fijo");
        return;
      }
      stepRef.current(delta);
    },
    [showFeedback],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (isSimulatorPointerLocked()) return;

      if (event.code === "KeyX" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        tryZoom(-1);
        return;
      }

      if (event.code === "KeyZ" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        tryZoom(1);
        return;
      }

      if (event.code === "BracketLeft") {
        event.preventDefault();
        tryZoom(-1);
        return;
      }

      if (event.code === "BracketRight") {
        event.preventDefault();
        tryZoom(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tryZoom]);

  if (!feedback) return null;

  return (
    <div className="cod-zoom-toast" role="status" aria-live="polite">
      {feedback}
    </div>
  );
}
