"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import {
  photographicPedestrianRuntime,
  setPhotographicPedestrianEnabled,
  setPhotographicPedestrianSpeedPreset,
  type PhotographicPedestrianSpeedPreset,
} from "@/lib/simulator/photographic-pedestrian-runtime";
import {
  photographicVehicleRuntime,
  setPhotographicVehicleEnabled,
  setPhotographicVehicleSpeedPreset,
  type PhotographicVehicleSpeedPreset,
} from "@/lib/simulator/photographic-vehicle-runtime";
import { AVAILABLE_SCENES, PLANNED_SCENES, isPhotographicScene } from "@/lib/simulator/scenes";
import type { SimulatorSceneId } from "@/lib/simulator/scenes";
import { useCallback, useState } from "react";

const VEHICLE_SPEED_OPTIONS: { id: PhotographicVehicleSpeedPreset; label: string }[] = [
  { id: "slow", label: "Lenta" },
  { id: "medium", label: "Media" },
  { id: "fast", label: "Rápida" },
];

const PEDESTRIAN_SPEED_OPTIONS: { id: PhotographicPedestrianSpeedPreset; label: string }[] = [
  { id: "slow", label: "Lenta" },
  { id: "normal", label: "Normal" },
  { id: "fast", label: "Rápida" },
];

export default function SceneTab() {
  const { sceneId, setSceneId } = useCameraStore();
  const photographic = isPhotographicScene(sceneId);
  const [vehicleOn, setVehicleOn] = useState(photographicVehicleRuntime.enabled);
  const [vehicleSpeed, setVehicleSpeed] = useState(photographicVehicleRuntime.speedPreset);
  const [pedestrianOn, setPedestrianOn] = useState(photographicPedestrianRuntime.enabled);
  const [pedestrianSpeed, setPedestrianSpeed] = useState(
    photographicPedestrianRuntime.speedPreset,
  );

  const toggleVehicle = useCallback(() => {
    const next = !vehicleOn;
    setVehicleOn(next);
    setPhotographicVehicleEnabled(next);
  }, [vehicleOn]);

  const selectVehicleSpeed = useCallback((preset: PhotographicVehicleSpeedPreset) => {
    setVehicleSpeed(preset);
    setPhotographicVehicleSpeedPreset(preset);
  }, []);

  const togglePedestrian = useCallback(() => {
    const next = !pedestrianOn;
    setPedestrianOn(next);
    setPhotographicPedestrianEnabled(next);
  }, [pedestrianOn]);

  const selectPedestrianSpeed = useCallback((preset: PhotographicPedestrianSpeedPreset) => {
    setPedestrianSpeed(preset);
    setPhotographicPedestrianSpeedPreset(preset);
  }, []);

  return (
    <div
      className="cod-side-panel cod-scene-panel"
      role="tabpanel"
      id="cod-side-panel-scene"
      aria-labelledby="cod-side-tab-scene"
    >
      <h3 className="cod-panel__subtitle">Escena activa</h3>
      <p className="cod-scene-panel__intro">
        Elegí el entorno de práctica. El estudio conserva iluminación controlada; la ciudad
        exterior es un prototipo técnico; Ciudad Fotográfica usa el pipeline realista (experimental).
      </p>

      <ul className="cod-scene-list" role="listbox" aria-label="Escenas disponibles">
        {AVAILABLE_SCENES.map((scene) => {
          const active = scene.id === sceneId;
          return (
            <li key={scene.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={`cod-scene-card${active ? " cod-scene-card--active" : ""}`}
                onClick={() => setSceneId(scene.id as SimulatorSceneId)}
              >
                <span className="cod-scene-card__title-row">
                  <span className="cod-scene-card__title">{scene.label}</span>
                  {scene.experimental ? (
                    <span className="cod-scene-card__badge">Experimental</span>
                  ) : null}
                </span>
                <span className="cod-scene-card__desc">{scene.description}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {photographic ? (
        <div className="cod-scene-traffic-stack">
          <div className="cod-scene-vehicle" aria-label="Tráfico experimental">
            <h4 className="cod-scene-vehicle__title">Auto</h4>
            <label className="cod-scene-vehicle__toggle">
              <input type="checkbox" checked={vehicleOn} onChange={toggleVehicle} />
              <span>En calle</span>
            </label>
            <div className="cod-scene-vehicle__speeds" role="group" aria-label="Velocidad del auto">
              {VEHICLE_SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cod-scene-vehicle__speed-btn${
                    vehicleSpeed === opt.id ? " cod-scene-vehicle__speed-btn--active" : ""
                  }`}
                  onClick={() => selectVehicleSpeed(opt.id)}
                  disabled={!vehicleOn}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cod-scene-vehicle" aria-label="Peatones experimentales">
            <h4 className="cod-scene-vehicle__title">Peatones</h4>
            <label className="cod-scene-vehicle__toggle">
              <input type="checkbox" checked={pedestrianOn} onChange={togglePedestrian} />
              <span>En vereda</span>
            </label>
            <div className="cod-scene-vehicle__speeds" role="group" aria-label="Velocidad de peatones">
              {PEDESTRIAN_SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cod-scene-vehicle__speed-btn${
                    pedestrianSpeed === opt.id ? " cod-scene-vehicle__speed-btn--active" : ""
                  }`}
                  onClick={() => selectPedestrianSpeed(opt.id)}
                  disabled={!pedestrianOn}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <h4 className="cod-scene-panel__future-title">Próximamente</h4>
      <ul className="cod-scene-future" aria-label="Escenas planificadas">
        {PLANNED_SCENES.map((scene) => (
          <li key={scene.id} className="cod-scene-future__item">
            {scene.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
