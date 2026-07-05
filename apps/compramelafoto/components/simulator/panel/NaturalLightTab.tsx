"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  formatTimeOfDay,
  TIME_OF_DAY_PRESETS,
  type TimeOfDayPresetId,
} from "@/lib/simulator/natural-light";
import { isExteriorScene } from "@/lib/simulator/scenes";

export default function NaturalLightTab() {
  const { sceneId, timeOfDayMinutes, sunState, setTimeOfDayMinutes, setWhiteBalance, settings } =
    useCameraStore();

  const exterior = isExteriorScene(sceneId);

  if (!exterior) {
    return (
      <div
        className="cod-side-panel cod-natural-light-panel"
        role="tabpanel"
        id="cod-side-panel-sun"
        aria-labelledby="cod-side-tab-sun"
      >
        <p className="cod-natural-light-panel__hint">
          La luz natural solar está disponible en escenas exteriores.
          El estudio usa iluminación artificial fija.
        </p>
        <p className="cod-natural-light-panel__hint cod-natural-light-panel__hint--muted">
          TODO: flash, softbox y modificadores de estudio en la solapa Iluminación.
        </p>
      </div>
    );
  }

  const applyPreset = (id: TimeOfDayPresetId) => {
    const preset = TIME_OF_DAY_PRESETS.find((p) => p.id === id);
    if (preset) setTimeOfDayMinutes(preset.minutes);
  };

  const applySuggestedWb = () => {
    setWhiteBalance(sunState.suggestedWbKelvin);
  };

  return (
    <div
      className="cod-side-panel cod-natural-light-panel"
      role="tabpanel"
      id="cod-side-panel-sun"
      aria-labelledby="cod-side-tab-sun"
    >
      <h3 className="cod-panel__subtitle">Hora del día</h3>
      <p className="cod-natural-light-panel__phase">
        {sunState.phaseLabel} · {formatTimeOfDay(timeOfDayMinutes)}
      </p>

      <label className="cod-natural-light-panel__slider-label" htmlFor="cod-time-slider">
        Hora
      </label>
      <input
        id="cod-time-slider"
        type="range"
        className="cod-natural-light-panel__slider"
        min={0}
        max={1439}
        step={5}
        value={timeOfDayMinutes}
        onChange={(e) => setTimeOfDayMinutes(Number(e.target.value))}
        aria-valuetext={formatTimeOfDay(timeOfDayMinutes)}
      />
      <div className="cod-natural-light-panel__time-readout" aria-live="polite">
        {formatTimeOfDay(timeOfDayMinutes)}
      </div>

      <div className="cod-natural-light-presets" role="group" aria-label="Presets de hora">
        {TIME_OF_DAY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="cod-natural-light-presets__btn"
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <h3 className="cod-panel__subtitle">Sol</h3>
      <dl className="cod-natural-light-stats">
        <div>
          <dt>Altura</dt>
          <dd>{Math.round(sunState.elevationDeg)}°</dd>
        </div>
        <div>
          <dt>Intensidad</dt>
          <dd>{sunState.sunIntensity.toFixed(1)}</dd>
        </div>
        <div>
          <dt>EV escena</dt>
          <dd>{sunState.luminanceEvOffset >= 0 ? "+" : ""}{sunState.luminanceEvOffset.toFixed(1)}</dd>
        </div>
      </dl>

      <h3 className="cod-panel__subtitle">Balance de blancos</h3>
      <p className="cod-natural-light-panel__hint">
        WB sugerido por la luz solar: <strong>{sunState.suggestedWbKelvin} K</strong>
        {settings.whiteBalance !== sunState.suggestedWbKelvin ? (
          <> · actual {settings.whiteBalance} K</>
        ) : null}
      </p>
      <button type="button" className="cod-natural-light-panel__wb-btn" onClick={applySuggestedWb}>
        Aplicar WB sugerido
      </button>

      <p className="cod-natural-light-panel__hint cod-natural-light-panel__hint--muted">
        En Ciudad Fotográfica, la hora selecciona el HDRI activo (ej. mediodía → <code>noon.hdr</code>).
      </p>

      <p className="cod-natural-light-panel__hint cod-natural-light-panel__hint--muted">
        TODO: clima, nubes, lluvia, niebla, nieve, tormenta y estaciones.
      </p>
    </div>
  );
}
