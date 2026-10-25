"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  formatTimeOfDay,
  TIME_OF_DAY_PRESETS,
  type TimeOfDayPresetId,
} from "@/lib/simulator/natural-light";
import { daylightEv100 } from "@/lib/simulator/scene-light";
import { WEATHER_IDS, WEATHER_LOOKS, weatherStore } from "@/lib/simulator/weather";
import { useSyncExternalStore } from "react";

export default function NaturalLightTab() {
  const { timeOfDayMinutes, sunState, setTimeOfDayMinutes, setWhiteBalance, settings } =
    useCameraStore();

  const applyPreset = (id: TimeOfDayPresetId) => {
    const preset = TIME_OF_DAY_PRESETS.find((p) => p.id === id);
    if (preset) setTimeOfDayMinutes(preset.minutes);
  };

  const weather = useSyncExternalStore(weatherStore.subscribe, weatherStore.get, weatherStore.get);

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

      <h3 className="cod-panel__subtitle">Clima</h3>
      <div className="cod-natural-light-presets" role="group" aria-label="Clima">
        {WEATHER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="cod-natural-light-presets__btn"
            aria-pressed={weather === id}
            onClick={() => weatherStore.set(id)}
          >
            {WEATHER_LOOKS[id].label}
          </button>
        ))}
      </div>
      <p className="cod-natural-light-panel__hint">{WEATHER_LOOKS[weather].hint}</p>

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
          <dt>Luz (EV100)</dt>
          <dd title="Sol pleno = 15: ISO 100, 1/125, f/16">
            {daylightEv100(timeOfDayMinutes).toFixed(1)}
          </dd>
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
        La hora selecciona el HDRI activo (ej. mediodía → <code>noon.hdr</code>).
      </p>

    </div>
  );
}
