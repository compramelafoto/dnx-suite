"use client";

import { verdictLabel } from "@/lib/simulator/camera-exposure";
import { useCameraStore } from "@/lib/simulator/camera-store";
import { useEffect, useState } from "react";

const PREVIEW_MS = 3000;

/**
 * Vista previa temporal tras disparar, alineada al recuadro de captura del visor.
 */
export default function CaptureFeedback() {
  const { lastCapture } = useCameraStore();
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (!lastCapture) return;
    setVisibleId(lastCapture.id);
  }, [lastCapture?.id]);

  useEffect(() => {
    if (!lastCapture?.previewUrl || visibleId !== lastCapture.id) return;
    const timer = window.setTimeout(() => setVisibleId(null), PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [lastCapture?.previewUrl, lastCapture?.id, visibleId]);

  if (!lastCapture || visibleId !== lastCapture.id) return null;

  const verdictClass =
    lastCapture.verdict === "under"
      ? "cod-capture--under"
      : lastCapture.verdict === "over"
        ? "cod-capture--over"
        : "cod-capture--ok";

  return (
    <div
      className={`cod-capture${verdictClass ? ` ${verdictClass}` : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="cod-capture__frame">
        {lastCapture.previewUrl ? (
          <img
            src={lastCapture.previewUrl}
            alt="Vista previa de la foto tomada"
            className="cod-capture__preview"
          />
        ) : (
          <div className="cod-capture__preview-placeholder" aria-hidden="true">
            Exponiendo…
          </div>
        )}

        <div className="cod-capture__meta">
          <p className="cod-capture__verdict">{verdictLabel(lastCapture.verdict)}</p>
          <p className="cod-capture__ev">{lastCapture.evLabel}</p>
          {lastCapture.pedagogyNotes && lastCapture.pedagogyNotes.length > 0 ? (
            <ul className="cod-capture__pedagogy">
              {lastCapture.pedagogyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
