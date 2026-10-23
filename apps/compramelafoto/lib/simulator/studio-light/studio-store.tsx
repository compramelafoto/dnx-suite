"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { MODIFIERS } from "./modifiers";
import { MAX_LIGHTS, PRESETS, applyPreset, initialStudioState, makeLight, polarToXZ, solvePowerStops } from "./presets";
import { poseById, type PoseId, type PoseParams } from "./poses";
import type { StudioCamera, StudioLight, StudioState } from "./types";

export type ScenePatch = Partial<Pick<StudioState, "subject" | "subjectYaw" | "backdrop" | "roomLux">>;

/** Encuadres rápidos: a qué altura apunta la cámara, focal y distancia. */
export const FRAMINGS = {
  face: { label: "Rostro", aimY: 1.62, focalMm: 85, dist: 2.5, height: 1.62 },
  half: { label: "Medio cuerpo", aimY: 1.3, focalMm: 85, dist: 4.2, height: 1.45 },
  full: { label: "Cuerpo entero", aimY: 0.92, focalMm: 50, dist: 4.6, height: 1.15 },
} as const;
export type FramingId = keyof typeof FRAMINGS;

type Action =
  | { type: "select"; id: string | null }
  | { type: "update-light"; id: string; patch: Partial<StudioLight> }
  | { type: "move-light"; id: string; x: number; z: number }
  | { type: "add-light"; modifier: StudioLight["modifier"] }
  | { type: "duplicate-light"; id: string }
  | { type: "remove-light"; id: string }
  | { type: "toggle-solo"; id: string }
  | { type: "auto-power"; id: string; ev: number }
  | { type: "camera"; patch: Partial<StudioCamera> }
  | { type: "scene"; patch: ScenePatch }
  | { type: "preset"; id: string }
  | { type: "pose"; id: PoseId }
  | { type: "pose-params"; patch: Partial<PoseParams> }
  | { type: "framing"; id: FramingId }
  | { type: "replace"; state: StudioState }
  | { type: "undo" }
  | { type: "redo" };

interface History {
  past: StudioState[];
  present: StudioState;
  future: StudioState[];
}

/** Límites del set (m). El fondo queda detrás del sujeto. */
export const SET_BOUNDS = { minX: -4.5, maxX: 4.5, minZ: -2.3, maxZ: 5.5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function apply(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "update-light":
      return {
        ...state,
        lights: state.lights.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
      };
    case "move-light":
      return {
        ...state,
        lights: state.lights.map((l) =>
          l.id === action.id
            ? {
                ...l,
                x: clamp(action.x, SET_BOUNDS.minX, SET_BOUNDS.maxX),
                z: clamp(action.z, SET_BOUNDS.minZ, SET_BOUNDS.maxZ),
              }
            : l,
        ),
      };
    case "add-light": {
      if (state.lights.length >= MAX_LIGHTS) return state;
      const index = state.lights.length;
      // Cada luz nueva entra en otro lugar del semicírculo para no encimarse.
      const az = [-45, 60, 140, -140, 100, -100][index % 6];
      const { x, z } = polarToXZ(az, 1.7);
      const draft = makeLight(index, {
        id: `luz-${Date.now().toString(36)}`,
        modifier: action.modifier,
        x,
        z,
        y: MODIFIERS[action.modifier].nature === "reflector" ? 1.3 : 2,
      });
      const light = { ...draft, powerStops: solvePowerStops(draft, state, index === 0 ? 0 : -1) };
      return { ...state, lights: [...state.lights, light], selectedId: light.id };
    }
    case "duplicate-light": {
      const src = state.lights.find((l) => l.id === action.id);
      if (!src || state.lights.length >= MAX_LIGHTS) return state;
      const copy: StudioLight = {
        ...src,
        id: `luz-${Date.now().toString(36)}`,
        name: `${src.name} (copia)`.slice(0, 24),
        x: -src.x,
        solo: false,
      };
      return { ...state, lights: [...state.lights, copy], selectedId: copy.id };
    }
    case "remove-light": {
      const lights = state.lights.filter((l) => l.id !== action.id);
      return {
        ...state,
        lights,
        selectedId: state.selectedId === action.id ? (lights[0]?.id ?? null) : state.selectedId,
      };
    }
    case "toggle-solo":
      return {
        ...state,
        lights: state.lights.map((l) => (l.id === action.id ? { ...l, solo: !l.solo, on: true } : l)),
      };
    case "auto-power":
      return {
        ...state,
        lights: state.lights.map((l) =>
          l.id === action.id ? { ...l, powerStops: solvePowerStops(l, state, action.ev) } : l,
        ),
      };
    case "camera":
      return { ...state, camera: { ...state.camera, ...action.patch } };
    case "scene":
      return { ...state, ...action.patch };
    case "pose":
      return { ...state, pose: action.id, poseParams: poseById(action.id) };
    case "pose-params":
      return { ...state, pose: "custom", poseParams: { ...state.poseParams, ...action.patch } };
    case "framing": {
      const f = FRAMINGS[action.id];
      // Conserva el ángulo de la cámara y sólo cambia distancia, altura y focal.
      const az = (Math.atan2(state.camera.x, state.camera.z) * 180) / Math.PI;
      const { x, z } = polarToXZ(az, f.dist);
      return { ...state, camera: { ...state.camera, x, z, y: f.height, aimY: f.aimY, focalMm: f.focalMm } };
    }
    case "preset": {
      const preset = PRESETS.find((p) => p.id === action.id);
      return preset
        ? { ...applyPreset(preset, state), subject: state.subject, pose: state.pose, poseParams: state.poseParams }
        : state;
    }
    case "replace":
      return action.state;
    default:
      return state;
  }
}

/** Acciones continuas (arrastrar, deslizar) no llenan el historial. */
const TRANSIENT = new Set<Action["type"]>(["select", "move-light"]);

function reducer(history: History, action: Action): History {
  if (action.type === "undo") {
    const prev = history.past[history.past.length - 1];
    if (!prev) return history;
    return { past: history.past.slice(0, -1), present: prev, future: [history.present, ...history.future] };
  }
  if (action.type === "redo") {
    const next = history.future[0];
    if (!next) return history;
    return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
  }
  const present = apply(history.present, action);
  if (present === history.present) return history;
  if (TRANSIENT.has(action.type)) return { ...history, present };
  return { past: [...history.past, history.present].slice(-60), present, future: [] };
}

interface StudioContextValue {
  state: StudioState;
  dispatch: (action: Action) => void;
  /** Guarda un punto de deshacer antes de un arrastre. */
  checkpoint: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const StudioContext = createContext<StudioContextValue | null>(null);

type CheckpointAction = { type: "checkpoint" };

function rootReducer(history: History, action: Action | CheckpointAction): History {
  if (action.type === "checkpoint") {
    return { past: [...history.past, history.present].slice(-60), present: history.present, future: [] };
  }
  return reducer(history, action);
}

export function StudioProvider({ children, initial }: { children: ReactNode; initial?: StudioState }) {
  const [history, dispatchRaw] = useReducer(rootReducer, undefined, () => ({
    past: [],
    present: initial ?? initialStudioState(),
    future: [],
  }));
  const value = useMemo<StudioContextValue>(
    () => ({
      state: history.present,
      dispatch: dispatchRaw,
      checkpoint: () => dispatchRaw({ type: "checkpoint" }),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history],
  );
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio debe usarse dentro de StudioProvider");
  return ctx;
}

export function useSelectedLight(): StudioLight | null {
  const { state } = useStudio();
  return state.lights.find((l) => l.id === state.selectedId) ?? null;
}
