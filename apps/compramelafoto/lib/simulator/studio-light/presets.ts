import { MODIFIERS } from "./modifiers";
import { BACKDROP_Z, SUBJECT_HEAD, aimPoint, emitterN2At, exposureEv } from "./metering";
import { NEUTRAL_POSE } from "./poses";
import type { BackdropId, LightAim, ModifierId, StudioLight, StudioState } from "./types";

export const MAX_LIGHTS = 6;
export const MAX_POWER_STOPS = 7;

export const DEFAULT_CAMERA: StudioState["camera"] = {
  x: 0,
  y: SUBJECT_HEAD[1],
  z: 2.5,
  focalMm: 85,
  aperture: 8,
  shutter: 1 / 125,
  iso: 100,
  whiteBalance: 5500,
  aimY: SUBJECT_HEAD[1],
  look: null,
};

const LIGHT_NAMES = ["Principal", "Relleno", "Contra", "Pelo", "Fondo", "Acento"];

/** Posición desde el sujeto: acimut (°), distancia horizontal (m) y altura del cabezal (m). */
export function polarToXZ(azDeg: number, dist: number): { x: number; z: number } {
  const a = (azDeg * Math.PI) / 180;
  return { x: Math.sin(a) * dist, z: Math.cos(a) * dist };
}

export function makeLight(
  index: number,
  partial: Partial<StudioLight> & { modifier: ModifierId },
): StudioLight {
  return {
    // Determinista: el estado inicial también se arma en el servidor.
    id: partial.id ?? `luz-${index + 1}`,
    name: partial.name ?? LIGHT_NAMES[index] ?? `Luz ${index + 1}`,
    on: partial.on ?? true,
    solo: false,
    modifier: partial.modifier,
    x: partial.x ?? 1,
    y: partial.y ?? 2,
    z: partial.z ?? 1,
    aim: partial.aim ?? "subject",
    powerStops: partial.powerStops ?? 3,
    gel: partial.gel ?? "none",
    kelvin: partial.kelvin ?? 5600,
  };
}

/** Punto donde se mide una luz según adónde apunta. */
function meterPoint(light: StudioLight) {
  if (light.aim === "background") return [0, 1.3, BACKDROP_Z] as [number, number, number];
  return aimPoint(light);
}

/**
 * Potencia (en tercios de paso) para que la luz dé `targetEv` respecto de la
 * exposición de cámara. Es el equivalente al modo TTL del Virtual Lighting Studio.
 */
export function solvePowerStops(light: StudioLight, state: StudioState, targetEv: number): number {
  if (MODIFIERS[light.modifier].nature === "reflector") return light.powerStops;
  const full = { ...light, powerStops: 0 };
  const n2 = emitterN2At(full, meterPoint(full), state.camera.shutter);
  const evAtFull = exposureEv(n2, state);
  if (!Number.isFinite(evAtFull)) return MAX_POWER_STOPS;
  const stops = Math.round((evAtFull - targetEv) * 3) / 3;
  return Math.min(MAX_POWER_STOPS, Math.max(0, stops));
}

interface PresetLight {
  modifier: ModifierId;
  az: number;
  dist: number;
  height: number;
  aim?: LightAim;
  /** Exposición buscada respecto de la cámara. */
  ev?: number;
  gel?: string;
  name?: string;
}

export interface StudioPreset {
  id: string;
  name: string;
  summary: string;
  lesson: string;
  backdrop: BackdropId;
  subjectYaw?: number;
  lights: PresetLight[];
}

export const PRESETS: StudioPreset[] = [
  {
    id: "loop",
    name: "Loop",
    summary: "La sombra de la nariz cae en diagonal sin tocar la mejilla.",
    lesson:
      "La luz principal va unos 30° al costado y un poco por encima de los ojos. Es el esquema más favorecedor para la mayoría de las caras.",
    backdrop: "grey",
    lights: [
      { modifier: "softbox-large", az: 32, dist: 1.5, height: 2.05, ev: 0 },
      { modifier: "umbrella-white", az: -40, dist: 2.6, height: 1.8, ev: -1.7 },
    ],
  },
  {
    id: "rembrandt",
    name: "Rembrandt",
    summary: "Un triángulo de luz debajo del ojo del lado en sombra.",
    lesson:
      "Subí la principal a unos 45° de costado y por encima de la cabeza. Si el triángulo se cierra, acercá la luz al eje de la cámara.",
    backdrop: "grey",
    lights: [
      { modifier: "softbox-large", az: 48, dist: 1.35, height: 2.2, ev: 0 },
      { modifier: "reflector-white", az: -62, dist: 1, height: 1.45 },
    ],
  },
  {
    id: "butterfly",
    name: "Mariposa (Paramount)",
    summary: "Sombra simétrica en forma de mariposa bajo la nariz.",
    lesson:
      "La luz va de frente, alta y apuntando hacia abajo. Marca pómulos; el plato de belleza le da brillo a la piel.",
    backdrop: "grey",
    lights: [{ modifier: "beauty-dish", az: 0, dist: 1.15, height: 2.3, ev: 0 }],
  },
  {
    id: "clamshell",
    name: "Clamshell (belleza)",
    summary: "Luz de arriba y rebote de abajo: casi sin sombras bajo los ojos.",
    lesson:
      "Como abrir una almeja: plato arriba, reflector plateado abajo. Usado en maquillaje y belleza.",
    backdrop: "white",
    lights: [
      { modifier: "beauty-dish", az: 0, dist: 1.05, height: 2.2, ev: 0 },
      { modifier: "reflector-silver", az: 0, dist: 0.6, height: 0.9 },
    ],
  },
  {
    id: "split",
    name: "Split (dividida)",
    summary: "La cara queda partida: una mitad con luz y la otra en sombra.",
    lesson: "La principal a 90° y a la altura de la cara. Dramático, masculino, de carácter.",
    backdrop: "black",
    lights: [{ modifier: "grid", az: 90, dist: 1.3, height: 1.7, ev: 0 }],
  },
  {
    id: "three-point",
    name: "Tres puntos",
    summary: "Principal, relleno y contraluz: la base de cine y video.",
    lesson:
      "La principal modela, el relleno controla el contraste y la contra separa al sujeto del fondo.",
    backdrop: "grey",
    lights: [
      { modifier: "softbox-large", az: 40, dist: 1.5, height: 2.1, ev: 0 },
      { modifier: "umbrella-white", az: -45, dist: 2.6, height: 1.7, ev: -1.7 },
      { modifier: "stripbox", az: 150, dist: 1.6, height: 2.0, ev: -0.3, name: "Contra" },
    ],
  },
  {
    id: "high-key",
    name: "Clave alta",
    summary: "Fondo blanco puro y sombras mínimas.",
    lesson:
      "Iluminá el fondo uno o dos pasos por encima del sujeto para que quede blanco sin perder detalle en la piel.",
    backdrop: "white",
    lights: [
      { modifier: "octabox", az: 0, dist: 1.7, height: 2.05, ev: 0 },
      { modifier: "bare", az: 128, dist: 1.6, height: 1.3, aim: "background", ev: 1.3, name: "Fondo izq." },
      { modifier: "bare", az: -128, dist: 1.6, height: 1.3, aim: "background", ev: 1.3, name: "Fondo der." },
    ],
  },
  {
    id: "low-key",
    name: "Clave baja",
    summary: "Fondo negro, una sola luz lateral y un toque de pelo.",
    lesson:
      "Alejá al sujeto del fondo y usá panal o stripbox para que la luz no lo alcance. Menos es más.",
    backdrop: "black",
    lights: [
      { modifier: "stripbox", az: 95, dist: 1.15, height: 1.9, ev: 0 },
      { modifier: "snoot", az: 165, dist: 1.3, height: 2.5, aim: "hair", ev: -0.5, name: "Pelo" },
    ],
  },
  {
    id: "kickers",
    name: "Doble contraluz",
    summary: "Dos franjas desde atrás dibujan el contorno de la cara.",
    lesson:
      "Las stripbox detrás del sujeto recortan mandíbula y orejas; un relleno frontal suave evita que la cara quede negra.",
    backdrop: "black",
    lights: [
      { modifier: "stripbox", az: 132, dist: 1.3, height: 1.8, ev: 0.3, name: "Contra izq." },
      { modifier: "stripbox", az: -132, dist: 1.3, height: 1.8, ev: 0.3, name: "Contra der." },
      { modifier: "softbox-small", az: 0, dist: 2.2, height: 1.9, ev: -1.3, name: "Relleno" },
    ],
  },
  {
    id: "cinema",
    name: "Cine cálido / frío",
    summary: "Principal cálida, contra azul y fondo verde azulado.",
    lesson:
      "Los geles separan planos por color. El contraste naranja/azul es el más usado en cine porque la piel resalta sobre el frío.",
    backdrop: "grey",
    lights: [
      { modifier: "softbox-small", az: 55, dist: 1.3, height: 1.95, ev: 0, gel: "cto" },
      { modifier: "stripbox", az: -140, dist: 1.5, height: 1.9, ev: 0.3, gel: "ctb", name: "Contra" },
      { modifier: "grid", az: 140, dist: 1.4, height: 1.1, aim: "background", ev: 0.3, gel: "teal", name: "Fondo" },
    ],
  },
  {
    id: "cenital",
    name: "Cenital",
    summary: "Luz justo encima de la cabeza: ojos en sombra y pómulos marcados.",
    lesson:
      "Es la luz de escenario y del cine negro. Cuelga de una jirafa para que el pie no entre en cuadro. Sumá un reflector abajo si querés recuperar la mirada.",
    backdrop: "black",
    lights: [
      { modifier: "beauty-dish", az: 0, dist: 0.3, height: 2.75, ev: 0, name: "Cenital" },
      { modifier: "grid", az: 180, dist: 1.4, height: 1.2, aim: "background", ev: -1.3, name: "Fondo" },
    ],
  },
  {
    id: "ring",
    name: "Ring light",
    summary: "Luz en el eje del objetivo: plana, sin sombras y con aro en los ojos.",
    lesson:
      "Al estar alrededor del lente, la sombra cae justo detrás del sujeto. Muy usado en moda y redes.",
    backdrop: "white",
    lights: [{ modifier: "ring", az: 0, dist: 2.38, height: 1.62, ev: 0 }],
  },
  {
    id: "window",
    name: "Luz de ventana",
    summary: "Fuente enorme al costado y rebote del otro lado.",
    lesson:
      "Una octabox grande y cerca imita una ventana. El reflector blanco abre las sombras sin que se note.",
    backdrop: "warm",
    lights: [
      { modifier: "octabox", az: 72, dist: 1.15, height: 1.85, ev: 0 },
      { modifier: "reflector-white", az: -70, dist: 0.95, height: 1.4 },
    ],
  },
  {
    id: "short",
    name: "Iluminación corta",
    summary: "Con la cara girada, se ilumina el lado que se aleja de la cámara.",
    lesson: "Afina la cara y le da volumen. Girá al sujeto y poné la luz del lado opuesto a la cámara.",
    backdrop: "grey",
    subjectYaw: 30,
    lights: [
      { modifier: "softbox-large", az: 62, dist: 1.4, height: 2.05, ev: 0 },
      { modifier: "reflector-white", az: -45, dist: 1.1, height: 1.4 },
    ],
  },
  {
    id: "broad",
    name: "Iluminación ancha",
    summary: "Con la cara girada, se ilumina el lado que mira a la cámara.",
    lesson: "Ensancha la cara. Útil en rostros muy delgados; en el resto, preferí la corta.",
    backdrop: "grey",
    subjectYaw: 30,
    lights: [
      { modifier: "softbox-large", az: -30, dist: 1.5, height: 2.05, ev: 0 },
      { modifier: "reflector-white", az: 75, dist: 1.1, height: 1.4 },
    ],
  },
];

/** Construye el estado de un esquema, ajustando potencias a la cámara actual. */
export function applyPreset(preset: StudioPreset, base: StudioState): StudioState {
  const camera = { ...base.camera };
  const draft: StudioState = {
    ...base,
    camera,
    backdrop: preset.backdrop,
    subjectYaw: preset.subjectYaw ?? 0,
    lights: [],
  };
  const lights = preset.lights.map((p, i) => {
    const { x, z } = polarToXZ(p.az, p.dist);
    const light = makeLight(i, {
      modifier: p.modifier,
      name: p.name,
      x,
      y: p.height,
      z,
      aim: p.aim ?? "subject",
      gel: p.gel ?? "none",
    });
    return { ...light, powerStops: solvePowerStops(light, draft, p.ev ?? 0) };
  });
  return { ...draft, lights, selectedId: lights[0]?.id ?? null };
}

export function initialStudioState(): StudioState {
  const empty: StudioState = {
    lights: [],
    selectedId: null,
    camera: DEFAULT_CAMERA,
    subject: "skin-medium",
    subjectYaw: 0,
    pose: "relaxed",
    poseParams: NEUTRAL_POSE,
    motion: { natural: true, clip: null },
    backdrop: "grey",
    roomLux: 40,
  };
  return applyPreset(PRESETS[0], empty);
}
