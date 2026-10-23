"use client";

import { useState, type CSSProperties } from "react";
import { GELS, MODIFIERS, MODIFIER_GROUPS, gelById, powerLabel } from "@/lib/simulator/studio-light/modifiers";
import { formatEv, formatShutter, kelvinToRgb, lightN2AtSubject, exposureEv } from "@/lib/simulator/studio-light/metering";
import { MAX_LIGHTS, MAX_POWER_STOPS, PRESETS, polarToXZ } from "@/lib/simulator/studio-light/presets";
import { FRAMINGS, useSelectedLight, useStudio, type FramingId, type ScenePatch } from "@/lib/simulator/studio-light/studio-store";
import type { LightAim, ModifierId, StudioLight } from "@/lib/simulator/studio-light/types";
import { BACKDROPS } from "./StudioBackdrop";
import StudioIcon from "./StudioIcons";
import { ANIMATIONS } from "@/lib/simulator/studio-light/animation-clip";
import { BUST_LABELS, FIGURES, figureUrl, isBust, type BustId } from "@/lib/simulator/studio-light/figures";
import { POSES, type ArmPose, type PoseParams } from "@/lib/simulator/studio-light/poses";

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
        // Tramo recorrido pintado con el color de acento.
        style={{ "--fill": `${((props.value - props.min) / (props.max - props.min || 1)) * 100}%` } as CSSProperties}
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
              className="cod-studio-btn"
              onClick={() => dispatch({ type: "auto-power", id: light.id, ev: ttlTarget })}
            >
              <StudioIcon name="meter" size={16} />
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

      <div className="cod-studio-editor__actions">
        <button
          type="button"
          className="cod-studio-btn"
          onClick={() => {
            // Encima de la cabeza y apenas adelante: la jirafa aparece sola.
            dispatch({ type: "move-light", id: light.id, x: 0, z: 0.3 });
            update({ y: 2.75, aim: "subject" });
          }}
        >
          <StudioIcon name="light" size={16} />
          Llevar arriba (cenital)
        </button>
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
        <button type="button" className="cod-studio-btn" onClick={() => dispatch({ type: "duplicate-light", id: light.id })} disabled={state.lights.length >= MAX_LIGHTS}>
          <StudioIcon name="copy" size={16} />
          Duplicar en espejo
        </button>
        <button type="button" className="cod-studio-btn cod-studio-btn--danger" onClick={() => dispatch({ type: "remove-light", id: light.id })}>
          <StudioIcon name="trash" size={16} />
          Quitar luz
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
                aria-label={`Ver sólo ${l.name}`}
                onClick={() => dispatch({ type: "toggle-solo", id: l.id })}
              >
                <StudioIcon name="solo" size={16} />
              </button>
            </li>
          );
        })}
      </ul>

      {state.lights.length < MAX_LIGHTS ? (
        <div className="cod-studio-add">
          <ModifierSelect value={adding} onChange={setAdding} />
          <button type="button" className="cod-studio-btn cod-studio-btn--accent" onClick={() => dispatch({ type: "add-light", modifier: adding })}>
            <StudioIcon name="plus" size={16} />
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
      <span className="cod-studio-field__label">Encuadre</span>
      <div className="cod-studio-chips">
        {(Object.keys(FRAMINGS) as FramingId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`cod-studio-chip${Math.abs(c.aimY - FRAMINGS[id].aimY) < 0.02 ? " cod-studio-chip--on" : ""}`}
            onClick={() => dispatch({ type: "framing", id })}
          >
            {FRAMINGS[id].label}
          </button>
        ))}
      </div>
      <Slider
        label="Altura del encuadre"
        value={c.aimY}
        min={0.4}
        max={2}
        step={0.01}
        display={m(c.aimY)}
        onChange={(v) => set({ aimY: v })}
      />
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

type GenderFilter = "todos" | "mujer" | "hombre";

function SubjectPicker() {
  const { state, dispatch } = useStudio();
  const [kind, setKind] = useState<"figure" | "bust">("figure");
  const [gender, setGender] = useState<GenderFilter>("todos");
  const choose = (id: string) => {
    const wasBust = isBust(state.subject);
    dispatch({ type: "scene", patch: { subject: id } });
    // Al pasar de busto a cuerpo entero (o al revés) el encuadre acompaña.
    if (wasBust !== isBust(id)) dispatch({ type: "framing", id: isBust(id) ? "face" : "full" });
  };
  const list = FIGURES.filter((f) => gender === "todos" || f.gender === gender);

  return (
    <>
      <div className="cod-studio-segment" role="group" aria-label="Tipo de modelo">
        <button type="button" className={`cod-studio-segment__btn${kind === "figure" ? " cod-studio-segment__btn--on" : ""}`} onClick={() => setKind("figure")}>
          Cuerpo entero
        </button>
        <button type="button" className={`cod-studio-segment__btn${kind === "bust" ? " cod-studio-segment__btn--on" : ""}`} onClick={() => setKind("bust")}>
          Busto
        </button>
      </div>
      {kind === "figure" ? (
        <>
          <div className="cod-studio-chips">
            {(["todos", "mujer", "hombre"] as const).map((g) => (
              <button key={g} type="button" className={`cod-studio-chip${gender === g ? " cod-studio-chip--on" : ""}`} onClick={() => setGender(g)}>
                {g === "todos" ? "Todos" : g === "mujer" ? "Mujeres" : "Hombres"}
              </button>
            ))}
          </div>
          <div className="cod-studio-figures">
            {list.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`cod-studio-figure${state.subject === f.id ? " cod-studio-figure--on" : ""}`}
                onClick={() => choose(f.id)}
                title={`${f.name} — ${f.outfit}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={figureUrl(f, "thumb.jpg")} alt="" loading="lazy" />
                <span className="cod-studio-figure__name">{f.name}</span>
                <span className="cod-studio-figure__outfit">{f.outfit}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="cod-studio-chips">
            {(Object.keys(BUST_LABELS) as BustId[]).map((id) => (
              <button key={id} type="button" className={`cod-studio-chip${state.subject === id ? " cod-studio-chip--on" : ""}`} onClick={() => choose(id)}>
                {BUST_LABELS[id]}
              </button>
            ))}
          </div>
          <p className="cod-studio-hint">El busto de yeso no tiene color ni brillo: sirve para estudiar sólo las formas de la luz.</p>
        </>
      )}
    </>
  );
}

const ARM_FIELDS: { key: keyof ArmPose; label: string; min: number; max: number }[] = [
  { key: "raise", label: "Levantar al costado", min: 0, max: 170 },
  { key: "forward", label: "Hacia adelante", min: -40, max: 170 },
  { key: "elbow", label: "Codo", min: 0, max: 150 },
  { key: "roll", label: "Dirección del codo", min: -90, max: 120 },
];

const BODY_FIELDS: { key: Exclude<keyof PoseParams, "left" | "right">; label: string; min: number; max: number; step?: number }[] = [
  { key: "headTurn", label: "Cabeza: girar", min: -70, max: 70 },
  { key: "headNod", label: "Cabeza: arriba / abajo", min: -35, max: 35 },
  { key: "headTilt", label: "Cabeza: inclinar", min: -30, max: 30 },
  { key: "torsoTurn", label: "Torso: girar", min: -45, max: 45 },
  { key: "torsoLean", label: "Torso: adelante / atrás", min: -20, max: 30 },
  { key: "torsoBend", label: "Torso: al costado", min: -20, max: 20 },
  { key: "weight", label: "Peso: pierna der. ↔ izq.", min: -1, max: 1, step: 0.1 },
];

function PosePicker() {
  const { state, dispatch } = useStudio();
  const p = state.poseParams;
  const current = POSES.find((x) => x.id === state.pose);
  const setArm = (side: "left" | "right", key: keyof ArmPose, v: number) =>
    dispatch({ type: "pose-params", patch: { [side]: { ...p[side], [key]: v } } as Partial<PoseParams> });

  return (
    <>
      <span className="cod-studio-field__label">Pose</span>
      <div className="cod-studio-chips">
        {POSES.map((pose) => (
          <button
            key={pose.id}
            type="button"
            className={`cod-studio-chip${state.pose === pose.id ? " cod-studio-chip--on" : ""}`}
            onClick={() => dispatch({ type: "pose", id: pose.id })}
          >
            {pose.label}
          </button>
        ))}
      </div>
      <p className="cod-studio-hint">{current ? current.hint : "Pose personalizada: ajustaste las articulaciones a mano."}</p>

      <span className="cod-studio-field__label">Movimiento</span>
      <label className="cod-studio-toggle">
        <button
          type="button"
          role="switch"
          aria-checked={state.motion.natural}
          className={`cod-studio-power${state.motion.natural ? " cod-studio-power--on" : ""}`}
          onClick={() => dispatch({ type: "motion", patch: { natural: !state.motion.natural } })}
        />
        <span>
          Natural mientras posa
          <small>Respira y se balancea apenas, como un modelo real.</small>
        </span>
      </label>
      <div className="cod-studio-chips">
        <button
          type="button"
          className={`cod-studio-chip${state.motion.clip === null ? " cod-studio-chip--on" : ""}`}
          onClick={() => dispatch({ type: "motion", patch: { clip: null } })}
        >
          Pose fija
        </button>
        {ANIMATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`cod-studio-chip${state.motion.clip === a.id ? " cod-studio-chip--on" : ""}`}
            onClick={() => dispatch({ type: "motion", patch: { clip: a.id } })}
          >
            {a.label}
          </button>
        ))}
      </div>
      {state.motion.clip ? (
        <p className="cod-studio-hint">Animación real capturada en movimiento. Elegí una pose para volver a posar.</p>
      ) : null}

      <details className="cod-studio-joints">
        <summary>Articular a mano</summary>
        {BODY_FIELDS.map((f) => (
          <Slider
            key={f.key}
            label={f.label}
            value={p[f.key]}
            min={f.min}
            max={f.max}
            step={f.step ?? 1}
            display={f.step ? p[f.key].toFixed(1).replace(".", ",") : `${Math.round(p[f.key])}°`}
            onChange={(v) => dispatch({ type: "pose-params", patch: { [f.key]: v } })}
          />
        ))}
        {(["left", "right"] as const).map((side) => (
          <fieldset key={side} className="cod-studio-joints__arm">
            <legend>{side === "left" ? "Brazo izquierdo (del modelo)" : "Brazo derecho (del modelo)"}</legend>
            {ARM_FIELDS.map((f) => (
              <Slider
                key={f.key}
                label={f.label}
                value={p[side][f.key]}
                min={f.min}
                max={f.max}
                step={1}
                display={`${Math.round(p[side][f.key])}°`}
                onChange={(v) => setArm(side, f.key, v)}
              />
            ))}
          </fieldset>
        ))}
        <button type="button" className="cod-studio-btn" onClick={() => dispatch({ type: "pose", id: "relaxed" })}>
          Volver a la pose neutra
        </button>
      </details>
    </>
  );
}

export function ScenePanel() {
  const { state, dispatch } = useStudio();
  const set = (patch: ScenePatch) => dispatch({ type: "scene", patch });

  return (
    <div className="cod-studio-panel">
      <SubjectPicker />
      {isBust(state.subject) ? null : <PosePicker />}

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
