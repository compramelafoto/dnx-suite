"use client";

import { useState } from "react";
import { GELS, MODIFIERS, MODIFIER_GROUPS, gelById, powerLabel } from "@/lib/simulator/studio-light/modifiers";
import { formatEv, formatShutter, kelvinToRgb, lightN2AtSubject, exposureEv } from "@/lib/simulator/studio-light/metering";
import { MAX_LIGHTS, MAX_POWER_STOPS, PRESETS, polarToXZ } from "@/lib/simulator/studio-light/presets";
import { useSelectedLight, useStudio, type ScenePatch } from "@/lib/simulator/studio-light/studio-store";
import type { LightAim, ModifierId, StudioLight, SubjectId } from "@/lib/simulator/studio-light/types";
import { BACKDROPS } from "./StudioBackdrop";
import { SUBJECT_LABELS } from "./StudioSubject";

const DEG = 180 / Math.PI;

const AIMS: { id: LightAim; label: string }[] = [
  { id: "subject", label: "Cara" },
  { id: "hair", label: "Pelo" },
  { id: "background", label: "Fondo" },
];

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="cod-studio-field">
      <span className="cod-studio-field__row">
        <span className="cod-studio-field__label">{props.label}</span>
        <span className="cod-studio-field__value">{props.display}</span>
      </span>
      <input
        type="range"
        className="cod-studio-range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Choice<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="cod-studio-field">
      <span className="cod-studio-field__label">{props.label}</span>
      <select
        className="cod-studio-select"
        value={String(props.value)}
        onChange={(e) => {
          const found = props.options.find((o) => String(o.value) === e.target.value);
          if (found) props.onChange(found.value);
        }}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const m = (n: number) => `${n.toFixed(2).replace(".", ",")} m`;

function ModifierSelect({ value, onChange }: { value: ModifierId; onChange: (v: ModifierId) => void }) {
  return (
    <label className="cod-studio-field">
      <span className="cod-studio-field__label">Modificador</span>
      <select className="cod-studio-select" value={value} onChange={(e) => onChange(e.target.value as ModifierId)}>
        {MODIFIER_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.ids.map((id) => (
              <option key={id} value={id}>
                {MODIFIERS[id].label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function LightEditor({ light }: { light: StudioLight }) {
  const { state, dispatch } = useStudio();
  const spec = MODIFIERS[light.modifier];
  const [ttlTarget, setTtlTarget] = useState(0);
  const update = (patch: Partial<StudioLight>) => dispatch({ type: "update-light", id: light.id, patch });

  const dist = Math.hypot(light.x, light.z);
  const az = Math.atan2(light.x, light.z) * DEG;
  const setPolar = (nextAz: number, nextDist: number) => {
    const { x, z } = polarToXZ(nextAz, nextDist);
    dispatch({ type: "move-light", id: light.id, x, z });
  };
  const ev = light.on ? exposureEv(lightN2AtSubject(light, state), state) : -Infinity;

  return (
    <div className="cod-studio-editor">
      <div className="cod-studio-editor__head">
        <input
          className="cod-studio-input"
          value={light.name}
          maxLength={24}
          aria-label="Nombre de la luz"
          onChange={(e) => update({ name: e.target.value })}
        />
        <span className="cod-studio-editor__ev">{formatEv(ev)}</span>
      </div>
      <p className="cod-studio-hint">{spec.hint}</p>

      <ModifierSelect value={light.modifier} onChange={(modifier) => update({ modifier })} />

      {spec.nature !== "reflector" ? (
        <>
          <Slider
            label={spec.nature === "flash" ? "Potencia" : "Intensidad"}
            value={MAX_POWER_STOPS - light.powerStops}
            min={0}
            max={MAX_POWER_STOPS}
            step={1 / 3}
            display={powerLabel(light.powerStops)}
            onChange={(v) => update({ powerStops: Math.round((MAX_POWER_STOPS - v) * 3) / 3 })}
          />
          <div className="cod-studio-ttl">
            <select
              className="cod-studio-select cod-studio-select--sm"
              value={ttlTarget}
              aria-label="Exposición buscada"
              onChange={(e) => setTtlTarget(Number(e.target.value))}
            >
              {[-3, -2, -1.7, -1, -0.7, -0.3, 0, 0.3, 0.7, 1, 1.3, 2].map((v) => (
                <option key={v} value={v}>
                  {formatEv(v)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="cod-btn cod-btn--secondary cod-btn--sm"
              onClick={() => dispatch({ type: "auto-power", id: light.id, ev: ttlTarget })}
            >
              Ajustar a la cámara (TTL)
            </button>
          </div>
        </>
      ) : null}

      <div className="cod-studio-segment" role="group" aria-label="Apunta a">
        {AIMS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`cod-studio-segment__btn${light.aim === a.id ? " cod-studio-segment__btn--on" : ""}`}
            onClick={() => update({ aim: a.id })}
          >
            {a.label}
          </button>
        ))}
      </div>

      <Slider label="Ángulo" value={Math.round(az)} min={-180} max={180} step={1} display={`${Math.round(az)}°`} onChange={(v) => setPolar(v, dist)} />
      <Slider label="Distancia" value={dist} min={0.4} max={5} step={0.05} display={m(dist)} onChange={(v) => setPolar(az, v)} />
      <Slider label="Altura" value={light.y} min={0.25} max={3.6} step={0.05} display={m(light.y)} onChange={(v) => update({ y: v })} />

      {spec.nature !== "reflector" ? (
        <label className="cod-studio-field">
          <span className="cod-studio-field__label">Gel</span>
          <div className="cod-studio-gels">
            {GELS.map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.label}
                aria-label={g.label}
                aria-pressed={light.gel === g.id}
                className={`cod-studio-gel${light.gel === g.id ? " cod-studio-gel--on" : ""}`}
                style={{ background: g.color }}
                onClick={() => update({ gel: g.id })}
              />
            ))}
          </div>
          <span className="cod-studio-hint">{gelById(light.gel).label}</span>
        </label>
      ) : null}

      {light.modifier === "led-panel" ? (
        <Slider
          label="Temperatura"
          value={light.kelvin}
          min={2700}
          max={7500}
          step={100}
          display={`${light.kelvin} K`}
          onChange={(v) => update({ kelvin: v })}
        />
      ) : null}

      <div className="cod-studio-editor__actions">
        <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" onClick={() => dispatch({ type: "duplicate-light", id: light.id })} disabled={state.lights.length >= MAX_LIGHTS}>
          Duplicar en espejo
        </button>
        <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" onClick={() => dispatch({ type: "remove-light", id: light.id })}>
          Quitar
        </button>
      </div>
    </div>
  );
}

export function LightsPanel() {
  const { state, dispatch } = useStudio();
  const selected = useSelectedLight();
  const [adding, setAdding] = useState<ModifierId>("softbox-large");

  return (
    <div className="cod-studio-panel">
      <ul className="cod-studio-lights">
        {state.lights.map((l) => {
          const spec = MODIFIERS[l.modifier];
          return (
            <li key={l.id} className={`cod-studio-light${l.id === state.selectedId ? " cod-studio-light--on" : ""}`}>
              <button
                type="button"
                className={`cod-studio-power${l.on ? " cod-studio-power--on" : ""}`}
                aria-label={l.on ? `Apagar ${l.name}` : `Encender ${l.name}`}
                aria-pressed={l.on}
                onClick={() => dispatch({ type: "update-light", id: l.id, patch: { on: !l.on, solo: l.on ? false : l.solo } })}
              />
              <button type="button" className="cod-studio-light__body" onClick={() => dispatch({ type: "select", id: l.id })}>
                <span className="cod-studio-light__name">
                  <i style={{ background: spec.nature === "reflector" ? spec.tint : gelById(l.gel).color }} />
                  {l.name}
                </span>
                <span className="cod-studio-light__meta">
                  {spec.label} · {spec.nature === "reflector" ? "rebote" : powerLabel(l.powerStops)}
                </span>
              </button>
              <button
                type="button"
                className={`cod-studio-solo${l.solo ? " cod-studio-solo--on" : ""}`}
                aria-pressed={l.solo}
                title="Ver sólo esta luz"
                onClick={() => dispatch({ type: "toggle-solo", id: l.id })}
              >
                S
              </button>
            </li>
          );
        })}
      </ul>

      {state.lights.length < MAX_LIGHTS ? (
        <div className="cod-studio-add">
          <ModifierSelect value={adding} onChange={setAdding} />
          <button type="button" className="cod-btn cod-btn--primary cod-btn--sm" onClick={() => dispatch({ type: "add-light", modifier: adding })}>
            Agregar luz
          </button>
        </div>
      ) : (
        <p className="cod-studio-hint">Llegaste al máximo de {MAX_LIGHTS} luces.</p>
      )}

      {selected ? <LightEditor key={selected.id} light={selected} /> : null}
    </div>
  );
}

const FOCALS = [24, 35, 50, 70, 85, 105, 135, 200];
const APERTURES = [1.4, 1.8, 2, 2.8, 3.5, 4, 5.6, 6.3, 8, 9, 10, 11, 13, 16, 22];
const SHUTTERS = [1 / 30, 1 / 60, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000];
const ISOS = [50, 100, 200, 400, 800, 1600, 3200, 6400];
const WB_PRESETS = [
  { k: 3200, label: "Tungsteno" },
  { k: 4000, label: "Fluorescente" },
  { k: 5500, label: "Flash / día" },
  { k: 6500, label: "Nublado" },
];

export function CameraPanel() {
  const { state, dispatch } = useStudio();
  const c = state.camera;
  const set = (patch: Partial<typeof c>) => dispatch({ type: "camera", patch });
  const dist = Math.hypot(c.x, c.z);
  const az = Math.atan2(c.x, c.z) * DEG;
  const wb = kelvinToRgb(c.whiteBalance);

  return (
    <div className="cod-studio-panel">
      <Choice label="Distancia focal" value={c.focalMm} options={FOCALS.map((f) => ({ value: f, label: `${f} mm` }))} onChange={(v) => set({ focalMm: v })} />
      <div className="cod-studio-grid3">
        <Choice label="Diafragma" value={c.aperture} options={APERTURES.map((a) => ({ value: a, label: `f/${a}` }))} onChange={(v) => set({ aperture: v })} />
        <Choice label="Obturador" value={c.shutter} options={SHUTTERS.map((s) => ({ value: s, label: formatShutter(s) }))} onChange={(v) => set({ shutter: v })} />
        <Choice label="ISO" value={c.iso} options={ISOS.map((i) => ({ value: i, label: String(i) }))} onChange={(v) => set({ iso: v })} />
      </div>
      <p className="cod-studio-hint">
        El flash dura menos que el obturador: con flash, el diafragma y el ISO controlan la exposición; el obturador sólo cambia cuánto entra de la luz de la sala.
      </p>

      <Slider
        label="Balance de blancos"
        value={c.whiteBalance}
        min={2800}
        max={7500}
        step={100}
        display={`${c.whiteBalance} K`}
        onChange={(v) => set({ whiteBalance: v })}
      />
      <div className="cod-studio-chips">
        {WB_PRESETS.map((p) => (
          <button key={p.k} type="button" className={`cod-studio-chip${c.whiteBalance === p.k ? " cod-studio-chip--on" : ""}`} onClick={() => set({ whiteBalance: p.k })}>
            {p.label}
          </button>
        ))}
        <span className="cod-studio-wb" style={{ background: `rgb(${wb.map((v) => Math.round(v * 255)).join(",")})` }} aria-hidden="true" />
      </div>

      <Slider label="Altura de cámara" value={c.y} min={0.5} max={2.8} step={0.05} display={m(c.y)} onChange={(v) => set({ y: v })} />
      <Slider
        label="Distancia al sujeto"
        value={dist}
        min={0.8}
        max={6}
        step={0.05}
        display={m(dist)}
        onChange={(v) => {
          const { x, z } = polarToXZ(az, v);
          set({ x, z });
        }}
      />
      <Slider
        label="Ángulo de cámara"
        value={Math.round(az)}
        min={-80}
        max={80}
        step={1}
        display={`${Math.round(az)}°`}
        onChange={(v) => {
          const { x, z } = polarToXZ(v, dist);
          set({ x, z });
        }}
      />
    </div>
  );
}

const ROOM_OPTIONS = [
  { value: 0, label: "A oscuras" },
  { value: 40, label: "Tenue (40 lx)" },
  { value: 300, label: "Oficina (300 lx)" },
  { value: 1000, label: "Muy iluminado (1000 lx)" },
];

export function ScenePanel() {
  const { state, dispatch } = useStudio();
  const set = (patch: ScenePatch) => dispatch({ type: "scene", patch });

  return (
    <div className="cod-studio-panel">
      <span className="cod-studio-field__label">Modelo</span>
      <div className="cod-studio-chips">
        {(Object.keys(SUBJECT_LABELS) as SubjectId[]).map((id) => (
          <button key={id} type="button" className={`cod-studio-chip${state.subject === id ? " cod-studio-chip--on" : ""}`} onClick={() => set({ subject: id })}>
            {SUBJECT_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="cod-studio-hint">El busto de yeso no tiene color ni brillo: sirve para estudiar sólo las formas de la luz.</p>

      <Slider
        label="Giro del sujeto"
        value={state.subjectYaw}
        min={-60}
        max={60}
        step={1}
        display={`${state.subjectYaw}°`}
        onChange={(v) => set({ subjectYaw: v })}
      />

      <span className="cod-studio-field__label">Fondo</span>
      <div className="cod-studio-chips">
        {(Object.keys(BACKDROPS) as (keyof typeof BACKDROPS)[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`cod-studio-chip cod-studio-chip--swatch${state.backdrop === id ? " cod-studio-chip--on" : ""}`}
            onClick={() => set({ backdrop: id })}
          >
            <i style={{ background: BACKDROPS[id].color }} />
            {BACKDROPS[id].label}
          </button>
        ))}
      </div>

      <Choice label="Luz de la sala" value={state.roomLux} options={ROOM_OPTIONS} onChange={(v) => set({ roomLux: v })} />
      <p className="cod-studio-hint">
        La luz de la sala es continua: si bajás la velocidad de obturación, entra más. Probá 1/30 con la sala en «Oficina».
      </p>
    </div>
  );
}

export function PresetsPanel({ onApplied }: { onApplied?: () => void }) {
  const { dispatch } = useStudio();
  return (
    <div className="cod-studio-panel">
      <p className="cod-studio-hint">
        Cada esquema arma las luces y ajusta la potencia a tu cámara. Después movelas para entender qué cambia.
      </p>
      <div className="cod-studio-presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="cod-studio-preset"
            onClick={() => {
              dispatch({ type: "preset", id: p.id });
              onApplied?.();
            }}
          >
            <span className="cod-studio-preset__name">{p.name}</span>
            <span className="cod-studio-preset__summary">{p.summary}</span>
            <span className="cod-studio-preset__lesson">{p.lesson}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
