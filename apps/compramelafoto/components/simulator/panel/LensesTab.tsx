"use client";

import Button from "@/components/ui/Button";
import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  formatLensCardSubtitle,
  formatLensFocalRange,
  formatLensMaxApertureLabel,
  SIMULATOR_LENSES,
} from "@/lib/simulator/lenses";
import LensCatalogThumb from "@/components/simulator/panel/LensCatalogThumb";
import { useCallback, useState } from "react";

export default function LensesTab() {
  const { lens, selectLens, setLensFocalLength, stepLensZoom } = useCameraStore();
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 1800);
  }, []);

  const handleZoomStep = useCallback(
    (delta: -1 | 1) => {
      if (!lens.isZoomLens) {
        showFeedback("Objetivo fijo");
        return;
      }
      stepLensZoom(delta);
    },
    [lens.isZoomLens, stepLensZoom, showFeedback],
  );

  const focalPercent =
    lens.maxFocalLengthMm === lens.minFocalLengthMm
      ? 0
      : ((lens.focalLengthMm - lens.minFocalLengthMm) /
          (lens.maxFocalLengthMm - lens.minFocalLengthMm)) *
        100;

  return (
    <div
      className="cod-side-panel cod-lenses-panel"
      role="tabpanel"
      id="cod-side-panel-lenses"
      aria-labelledby="cod-side-tab-lenses"
    >
      <p className="cod-lenses-panel__intro">
        Cambiá el objetivo para ver cómo la distancia focal modifica el encuadre, el campo visual y
        la profundidad de campo.
      </p>

      <div className="cod-lens-catalog" role="list" aria-label="Catálogo de objetivos">
        {SIMULATOR_LENSES.map((def) => {
          const selected = lens.lensId === def.id;
          return (
            <button
              key={def.id}
              type="button"
              role="listitem"
              className={`cod-lens-card${selected ? " cod-lens-card--active" : ""}`}
              aria-pressed={selected}
              onClick={() => selectLens(def.id)}
            >
              <LensCatalogThumb lens={def} />
              <span className="cod-lens-card__body">
                <span className="cod-lens-card__name">{def.name}</span>
                <span className="cod-lens-card__meta">
                  {formatLensFocalRange(def)} · {formatLensMaxApertureLabel(def)}
                </span>
                <span className="cod-lens-card__uses">{formatLensCardSubtitle(def)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="cod-param-divider" aria-hidden="true" />

      <h3 className="cod-panel__subtitle">Distancia focal</h3>

      {lens.isZoomLens ? (
        <div className="cod-lens-zoom">
          <div className="cod-lens-zoom__readout">
            <span>{lens.minFocalLengthMm}mm</span>
            <strong>{lens.focalLengthMm}mm</strong>
            <span>{lens.maxFocalLengthMm}mm</span>
          </div>
          <input
            type="range"
            className="cod-lens-zoom__slider"
            min={lens.minFocalLengthMm}
            max={lens.maxFocalLengthMm}
            step={1}
            value={lens.focalLengthMm}
            aria-label="Distancia focal"
            onChange={(event) => setLensFocalLength(Number(event.target.value))}
            style={{
              background: `linear-gradient(to right, var(--cod-blue) 0%, var(--cod-blue) ${focalPercent}%, var(--cod-border) ${focalPercent}%, var(--cod-border) 100%)`,
            }}
          />
          <div className="cod-lens-zoom__actions">
            <Button
              variant="secondary"
              size="md"
              type="button"
              aria-label="Zoom out (más angular)"
              onClick={() => handleZoomStep(-1)}
            >
              X
            </Button>
            <Button
              variant="secondary"
              size="md"
              type="button"
              aria-label="Zoom in (más tele)"
              onClick={() => handleZoomStep(1)}
            >
              Z
            </Button>
          </div>
          <p className="cod-lens-zoom__hint">
            <kbd>X</kbd> = Zoom out · <kbd>Z</kbd> = Zoom in (sin navegación Pointer Lock). Alternativa:{" "}
            <kbd>[</kbd> / <kbd>]</kbd>
          </p>
        </div>
      ) : (
        <div className="cod-lens-prime">
          <p className="cod-lens-prime__focal">
            Focal fija: <strong>{lens.focalLengthMm}mm</strong>
          </p>
          <p className="cod-lens-prime__hint">
            Focal fija: acercate o alejate físicamente para cambiar el encuadre.
          </p>
        </div>
      )}

      {feedback ? (
        <p className="cod-lens-feedback" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
