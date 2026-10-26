/**
 * Flashes de la calle: uno sobre la cámara y hasta tres fuera de cámara (en
 * pie, con modificador). El flash dura una fracción de milisegundo: su luz no
 * depende del tiempo de exposición (sólo del diafragma, el ISO, la potencia y
 * la distancia), salvo que el tiempo sea más corto que la sincronización.
 */

export type FlashModifier = "directo" | "paraguas" | "softbox" | "stripbox";

export interface OffCameraFlash {
  id: string;
  /** Posición del cabezal (m). */
  position: [number, number, number];
  /** Hacia dónde apunta: giro horizontal e inclinación (grados). */
  yawDeg: number;
  pitchDeg: number;
  /** Pasos bajo plena potencia (0 = 1/1 … 7 = 1/128). */
  powerStops: number;
  modifier: FlashModifier;
  on: boolean;
}

export interface FlashState {
  onCamera: { on: boolean; powerStops: number };
  offCamera: OffCameraFlash[];
  /** Ver el efecto del flash en el visor (en una cámara real sólo se ve en la foto). */
  preview: boolean;
}

export const MAX_OFF_CAMERA_FLASHES = 3;
export const MAX_POWER_STOPS = 7;
/** Sincronización del flash (s): más corto, la cortina tapa parte del cuadro. */
export const FLASH_SYNC_SECONDS = 1 / 250;
/** Número guía a plena potencia (ISO 100, metros): un flash de mano común. */
export const GUIDE_NUMBER = 40;

export interface ModifierSpec {
  label: string;
  /** Medio ángulo del haz (rad) y borde suave (0–1). */
  angle: number;
  penumbra: number;
  /** Luz que se pierde en el modificador (pasos). */
  lossStops: number;
  /** Explicación corta para el panel. */
  hint: string;
}

export const MODIFIERS: Record<FlashModifier, ModifierSpec> = {
  directo: { label: "Directo", angle: 0.42, penumbra: 0.25, lossStops: 0, hint: "Luz dura: sombras marcadas y bordes nítidos." },
  paraguas: { label: "Paraguas", angle: 1.05, penumbra: 0.85, lossStops: 1, hint: "Luz suave y amplia: ilumina mucho alrededor." },
  softbox: { label: "Softbox", angle: 0.85, penumbra: 1, lossStops: 1, hint: "Luz suave y controlada: la clásica de retrato." },
  stripbox: { label: "Stripbox", angle: 0.5, penumbra: 0.9, lossStops: 1.5, hint: "Franja angosta de luz: recortes y contornos." },
};

export function powerLabel(stops: number): string {
  return `1/${Math.round(2 ** Math.max(0, Math.min(MAX_POWER_STOPS, stops)))}`;
}

/**
 * Energía del flash para el render (candela·segundo equivalente) a la potencia
 * dada: con número guía GN, a 1/1 e ISO 100 la exposición es correcta con
 * f = GN / distancia. En lux·s: H = 2,5 · N² (fotómetro incidente, C = 250).
 */
export function flashEnergy(powerStops: number, lossStops = 0): number {
  return 2.5 * GUIDE_NUMBER * GUIDE_NUMBER * 2 ** -(powerStops + lossStops);
}

/**
 * Intensidad "como si fuera luz continua" durante el tiempo de exposición: así
 * la ganancia de exposición del render (que sí depende del tiempo) se cancela y
 * el flash queda igual con cualquier tiempo hasta la sincronización.
 */
export function flashIntensityForShutter(energy: number, shutterSeconds: number): number {
  const t = Math.max(1e-5, shutterSeconds);
  // Más corto que la sincronización: sólo una parte del cuadro recibe el destello.
  const sync = Math.min(1, t / FLASH_SYNC_SECONDS);
  return (energy / t) * sync;
}

/** Diafragma correcto para un flash a esta distancia (ISO y potencia dados). */
export function correctAperture(distanceM: number, iso: number, powerStops: number, lossStops = 0): number {
  return (GUIDE_NUMBER * Math.sqrt(iso / 100) * 2 ** (-(powerStops + lossStops) / 2)) / Math.max(0.1, distanceM);
}

let state: FlashState = { onCamera: { on: false, powerStops: 3 }, offCamera: [], preview: true };
const listeners = new Set<() => void>();
let nextId = 1;

function set(next: FlashState) {
  state = next;
  for (const l of listeners) l();
}

export const flashStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): FlashState {
    return state;
  },
  setOnCamera(patch: Partial<FlashState["onCamera"]>) {
    set({ ...state, onCamera: { ...state.onCamera, ...patch } });
  },
  setPreview(preview: boolean) {
    set({ ...state, preview });
  },
  add(flash: Omit<OffCameraFlash, "id">): string | null {
    if (state.offCamera.length >= MAX_OFF_CAMERA_FLASHES) return null;
    const id = `flash-${nextId++}`;
    set({ ...state, offCamera: [...state.offCamera, { ...flash, id }] });
    return id;
  },
  update(id: string, patch: Partial<OffCameraFlash>) {
    set({ ...state, offCamera: state.offCamera.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  },
  remove(id: string) {
    set({ ...state, offCamera: state.offCamera.filter((f) => f.id !== id) });
  },
  /** ¿Hay algún flash que dispare? */
  active(): boolean {
    return state.onCamera.on || state.offCamera.some((f) => f.on);
  },
};
