"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { findMovingSubject } from "@/lib/simulator/moving-subject-types";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  MAX_OFF_CAMERA_FLASHES,
  MAX_POWER_STOPS,
  MODIFIERS,
  correctAperture,
  flashStore,
  powerLabel,
  type FlashModifier,
  type OffCameraFlash,
} from "@/lib/simulator/street/flash";
import { AVATAR_FIGURES, thirdPersonStore } from "@/lib/simulator/street/third-person";
import { useSyncExternalStore } from "react";

/** Elige el avatar y lo guarda en el perfil (si falla, queda elegido igual en esta visita). */
function chooseAvatar(figureId: string) {
  thirdPersonStore.setFigure(figureId);
  void fetch("/api/camofduty/avatar", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ figureId }) }).catch(() => null);
}

function ThirdPersonSection() {
  const view = useSyncExternalStore(thirdPersonStore.subscribe, thirdPersonStore.get, thirdPersonStore.get);
  return (
    <>
      <h3 className="cod-panel__subtitle">Vista de afuera</h3>
      <button type="button" className={`cod-option-btn${view.on ? " cod-option-btn--active" : ""} cod-flash__add`} onClick={() => thirdPersonStore.setOn(!view.on)}>
        {view.on ? "Volver a la cámara" : "Ver en tercera persona"}
      </button>
      <p className="cod-natural-light-panel__hint">
        {view.on
          ? "Arrastrá para girar alrededor del fotógrafo y usá la rueda (o el joystick) para acercarte. Desde acá se acomodan los flashes; para sacar la foto, volvé a la cámara."
          : "Mirá la escena desde afuera, con tu fotógrafo y los flashes, para acomodar la luz."}
      </p>
      <span className="cod-param-option__label">Tu fotógrafo</span>
      <div className="cod-param-options">
        {AVATAR_FIGURES.map((f) => (
          <button key={f.id} type="button" className={`cod-option-btn${view.figure === f.id ? " cod-option-btn--active" : ""}`} onClick={() => chooseAvatar(f.id)} title={f.outfit}>
            {f.name}
          </button>
        ))}
      </div>
    </>
  );
}

const MODIFIER_IDS = Object.keys(MODIFIERS) as FlashModifier[];

/** Rumbo e inclinación para que un flash en `from` apunte a `to`. */
function aimAt(from: [number, number, number], to: [number, number, number]): { yawDeg: number; pitchDeg: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return { yawDeg: (Math.atan2(dx, dz) * 180) / Math.PI, pitchDeg: (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI };
}

/** A dónde apuntar: el sujeto enfocado o, si no hay, 4 m delante de la cámara. */
function aimTarget(): [number, number, number] | null {
  const subject = findMovingSubject(simulatorRuntime.movingSubjects, simulatorRuntime.focusedObjectId);
  if (subject) return [subject.position[0], subject.position[1] + 1.4, subject.position[2]];
  const pose = simulatorRuntime.cameraPose?.();
  if (!pose) return null;
  const yaw = (pose.yawDeg * Math.PI) / 180;
  return [pose.position[0] + Math.sin(yaw) * 4, pose.position[1] - 0.2, pose.position[2] + Math.cos(yaw) * 4];
}

function Stepper({ value, onChange }: { value: number; onChange: (stops: number) => void }) {
  return (
    <div className="cod-flash__stepper">
      <button type="button" className="cod-option-btn" onClick={() => onChange(Math.min(MAX_POWER_STOPS, value + 1))} aria-label="Menos potencia">
        −
      </button>
      <span>{powerLabel(value)}</span>
      <button type="button" className="cod-option-btn" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Más potencia">
        +
      </button>
    </div>
  );
}

function OffCameraCard({ flash, index }: { flash: OffCameraFlash; index: number }) {
  const update = (patch: Partial<OffCameraFlash>) => flashStore.update(flash.id, patch);
  return (
    <div className="cod-flash__card">
      <div className="cod-flash__row">
        <strong>Flash {index + 1}</strong>
        <label className="cod-flash__toggle">
          <input type="checkbox" checked={flash.on} onChange={(e) => update({ on: e.target.checked })} /> Encendido
        </label>
      </div>
      <div className="cod-flash__row">
        <span className="cod-param-option__label">Potencia</span>
        <Stepper value={flash.powerStops} onChange={(powerStops) => update({ powerStops })} />
      </div>
      <div className="cod-param-options">
        {MODIFIER_IDS.map((m) => (
          <button key={m} type="button" className={`cod-option-btn${flash.modifier === m ? " cod-option-btn--active" : ""}`} onClick={() => update({ modifier: m })}>
            {MODIFIERS[m].label}
          </button>
        ))}
      </div>
      <p className="cod-natural-light-panel__hint">{MODIFIERS[flash.modifier].hint}</p>
      <div className="cod-flash__aim">
        <button type="button" className="cod-option-btn" onClick={() => update({ yawDeg: flash.yawDeg + 10 })}>
          ↶ Girar
        </button>
        <button type="button" className="cod-option-btn" onClick={() => update({ yawDeg: flash.yawDeg - 10 })}>
          Girar ↷
        </button>
        <button type="button" className="cod-option-btn" onClick={() => update({ pitchDeg: Math.min(80, flash.pitchDeg + 5) })}>
          Más arriba
        </button>
        <button type="button" className="cod-option-btn" onClick={() => update({ pitchDeg: Math.max(-60, flash.pitchDeg - 5) })}>
          Más abajo
        </button>
        <button type="button" className="cod-option-btn" onClick={() => update({ position: [flash.position[0], Math.min(3.2, flash.position[1] + 0.2), flash.position[2]] })}>
          Subir el pie
        </button>
        <button type="button" className="cod-option-btn" onClick={() => update({ position: [flash.position[0], Math.max(0.8, flash.position[1] - 0.2), flash.position[2]] })}>
          Bajar el pie
        </button>
      </div>
      <div className="cod-flash__row">
        <button
          type="button"
          className="cod-option-btn"
          onClick={() => {
            const to = aimTarget();
            if (to) update(aimAt(flash.position, to));
          }}
        >
          Apuntar al sujeto
        </button>
        <button type="button" className="cod-option-btn" onClick={() => flashStore.remove(flash.id)}>
          Sacar
        </button>
      </div>
    </div>
  );
}

/**
 * Flash en la calle: sobre la cámara o en pies con modificadores. Enseña que el
 * tiempo de exposición controla la luz ambiente y el diafragma, la del flash.
 */
export default function FlashTab() {
  const state = useSyncExternalStore(flashStore.subscribe, flashStore.get, flashStore.get);
  const { settings, focus } = useCameraStore();
  const fNeeded = correctAperture(focus.distanceM, settings.iso, state.onCamera.powerStops);

  const place = () => {
    const pose = simulatorRuntime.cameraPose?.();
    if (!pose) return;
    const yaw = (pose.yawDeg * Math.PI) / 180;
    // Adelante y a la izquierda del fotógrafo, a 2 m del piso: luz a 45°, como en el estudio.
    const ground = simulatorRuntime.walkableWorld?.groundHeight(pose.position[0], pose.position[2]) ?? 0;
    const side = state.offCamera.length % 2 === 0 ? 1 : -1;
    const position: [number, number, number] = [
      pose.position[0] + Math.sin(yaw) * 1.5 + Math.cos(yaw) * 1.4 * side,
      ground + 2,
      pose.position[2] + Math.cos(yaw) * 1.5 - Math.sin(yaw) * 1.4 * side,
    ];
    const to = aimTarget();
    const aim = to ? aimAt(position, to) : { yawDeg: pose.yawDeg, pitchDeg: -10 };
    flashStore.add({ position, ...aim, powerStops: 3, modifier: "softbox", on: true });
  };

  return (
    <div className="cod-flash">
      <p className="cod-natural-light-panel__hint">
        El tiempo de exposición controla la luz ambiente; el diafragma y el ISO, la del flash. Más corto que 1/250 (sincronización), el flash ya no cubre todo el cuadro.
      </p>
      <label className="cod-flash__toggle">
        <input type="checkbox" checked={state.preview} onChange={(e) => flashStore.setPreview(e.target.checked)} /> Ver el efecto del flash en el visor
      </label>

      <h3 className="cod-panel__subtitle">Flash sobre la cámara</h3>
      <div className="cod-flash__card">
        <div className="cod-flash__row">
          <label className="cod-flash__toggle">
            <input type="checkbox" checked={state.onCamera.on} onChange={(e) => flashStore.setOnCamera({ on: e.target.checked })} /> Encendido
          </label>
          <Stepper value={state.onCamera.powerStops} onChange={(powerStops) => flashStore.setOnCamera({ powerStops })} />
        </div>
        {state.onCamera.on ? (
          <p className="cod-natural-light-panel__hint">
            Para lo que está a {focus.distanceM.toFixed(1).replace(".", ",")} m (foco), con ISO {settings.iso} y {powerLabel(state.onCamera.powerStops)}: diafragma f/
            {fNeeded.toFixed(1).replace(".", ",")}.
          </p>
        ) : null}
      </div>

      <h3 className="cod-panel__subtitle">Flashes fuera de cámara</h3>
      {state.offCamera.map((f, i) => (
        <OffCameraCard key={f.id} flash={f} index={i} />
      ))}
      {state.offCamera.length < MAX_OFF_CAMERA_FLASHES ? (
        <button type="button" className="cod-option-btn cod-option-btn--active cod-flash__add" onClick={place}>
          Poner un flash acá (apunta al sujeto enfocado)
        </button>
      ) : (
        <p className="cod-natural-light-panel__hint">Hasta {MAX_OFF_CAMERA_FLASHES} flashes a la vez.</p>
      )}
      <p className="cod-natural-light-panel__hint">
        Consejo: pará a una persona (tecla T o el botón Hablarle), enfocála y poné los flashes alrededor, como en el estudio.
      </p>
      <ThirdPersonSection />
    </div>
  );
}
