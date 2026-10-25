import type { LightNature, ModifierId } from "./types";

export type ModifierShape = "point" | "rect" | "round" | "ring" | "panel";

export interface ModifierSpec {
  id: ModifierId;
  label: string;
  nature: LightNature;
  shape: ModifierShape;
  /** Tamaño de la superficie emisora (m). */
  width: number;
  height: number;
  /** Apertura del haz (grados, ángulo completo). */
  beamDeg: number;
  /** Borde del haz: 0 = corte duro, 1 = degradé muy suave. */
  penumbra: number;
  /** Pérdida de luz respecto del reflector estándar (EV, negativo = pierde). */
  efficiencyEv: number;
  /**
   * Parte de la luz que se dibuja como superficie (brillos y reflejos grandes).
   * Las luces de área de three.js no proyectan sombras: si esta parte es grande,
   * la sombra de la nariz desaparece.
   */
  areaShare: number;
  /** Plena potencia: número guía (m, ISO 100) en flash; lux a 1 m en continuas. */
  fullOutput: number;
  /** Factor de reflexión, sólo reflectores pasivos. */
  reflectance?: number;
  /** Tinte del rebote, sólo reflectores pasivos. */
  tint?: string;
  hint: string;
}

/** Número guía de una antorcha de 400 Ws con reflector estándar (m, ISO 100). */
export const BASE_GUIDE_NUMBER = 45;

/** Sincronización máxima del flash (s). */
export const FLASH_SYNC_SPEED = 1 / 250;

export const MODIFIERS: Record<ModifierId, ModifierSpec> = {
  bare: {
    id: "bare",
    label: "Reflector estándar",
    nature: "flash",
    shape: "round",
    width: 0.18,
    height: 0.18,
    beamDeg: 70,
    penumbra: 0.35,
    efficiencyEv: 0,
    areaShare: 0,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Fuente chica y dura: sombras con borde marcado y mucho contraste.",
  },
  snoot: {
    id: "snoot",
    label: "Snoot",
    nature: "flash",
    shape: "round",
    width: 0.06,
    height: 0.06,
    beamDeg: 18,
    penumbra: 0.25,
    efficiencyEv: -1.7,
    areaShare: 0,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Un círculo de luz muy concentrado. Ideal para luz de pelo o acentos en el fondo.",
  },
  grid: {
    id: "grid",
    label: "Reflector con panal",
    nature: "flash",
    shape: "round",
    width: 0.18,
    height: 0.18,
    beamDeg: 30,
    penumbra: 0.45,
    efficiencyEv: -1,
    areaShare: 0,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "El panal recorta el haz: la luz no se derrama sobre el fondo.",
  },
  "beauty-dish": {
    id: "beauty-dish",
    label: "Plato de belleza 55 cm",
    nature: "flash",
    shape: "round",
    width: 0.55,
    height: 0.55,
    beamDeg: 75,
    penumbra: 0.6,
    efficiencyEv: -0.8,
    areaShare: 0.12,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Entre dura y suave: piel con brillo y contraste. El clásico de la luz mariposa.",
  },
  "umbrella-white": {
    id: "umbrella-white",
    label: "Paraguas blanco 100 cm",
    nature: "flash",
    shape: "round",
    width: 1,
    height: 1,
    beamDeg: 120,
    penumbra: 1,
    efficiencyEv: -1.3,
    areaShare: 0.17,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Luz amplia y envolvente que se derrama por todo el set. Buena para relleno.",
  },
  "softbox-small": {
    id: "softbox-small",
    label: "Softbox 40×50",
    nature: "flash",
    shape: "rect",
    width: 0.4,
    height: 0.5,
    beamDeg: 95,
    penumbra: 0.85,
    efficiencyEv: -1.7,
    areaShare: 0.17,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Luz suave en un tamaño manejable. Cuanto más cerca, más suave.",
  },
  "softbox-large": {
    id: "softbox-large",
    label: "Softbox 60×90",
    nature: "flash",
    shape: "rect",
    width: 0.6,
    height: 0.9,
    beamDeg: 100,
    penumbra: 0.9,
    efficiencyEv: -2,
    areaShare: 0.19,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "La luz principal más usada en retrato: sombras suaves y transiciones largas.",
  },
  octabox: {
    id: "octabox",
    label: "Octabox 120 cm",
    nature: "flash",
    shape: "round",
    width: 1.2,
    height: 1.2,
    beamDeg: 105,
    penumbra: 0.95,
    efficiencyEv: -2.2,
    areaShare: 0.21,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Muy grande y redonda: luz de ventana, reflejo circular en los ojos.",
  },
  stripbox: {
    id: "stripbox",
    label: "Stripbox 30×120",
    nature: "flash",
    shape: "rect",
    width: 0.3,
    height: 1.2,
    beamDeg: 90,
    penumbra: 0.85,
    efficiencyEv: -2,
    areaShare: 0.17,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Franja alta y angosta: perfecta para recortar el contorno desde atrás.",
  },
  ring: {
    id: "ring",
    label: "Ring light",
    nature: "flash",
    shape: "ring",
    width: 0.45,
    height: 0.45,
    beamDeg: 80,
    penumbra: 0.7,
    efficiencyEv: -0.5,
    areaShare: 0.1,
    fullOutput: BASE_GUIDE_NUMBER,
    hint: "Va alrededor del objetivo: casi sin sombras y un aro de luz en los ojos.",
  },
  fresnel: {
    id: "fresnel",
    label: "Fresnel 650 W",
    nature: "continuous",
    shape: "round",
    width: 0.15,
    height: 0.15,
    beamDeg: 35,
    penumbra: 0.4,
    efficiencyEv: 0,
    areaShare: 0,
    fullOutput: 9000,
    hint: "Luz continua de cine: dura y dirigida. Su exposición depende del obturador.",
  },
  "led-panel": {
    id: "led-panel",
    label: "Panel LED 60×30",
    nature: "continuous",
    shape: "panel",
    width: 0.6,
    height: 0.3,
    beamDeg: 100,
    penumbra: 0.9,
    efficiencyEv: 0,
    areaShare: 0.17,
    fullOutput: 3500,
    hint: "Luz continua con temperatura regulable. Ves el resultado mientras lo movés.",
  },
  "reflector-white": {
    id: "reflector-white",
    label: "Reflector blanco 110 cm",
    nature: "reflector",
    shape: "round",
    width: 1.1,
    height: 1.1,
    beamDeg: 150,
    penumbra: 1,
    efficiencyEv: 0,
    areaShare: 0.21,
    fullOutput: 0,
    reflectance: 0.6,
    tint: "#ffffff",
    hint: "No emite luz: devuelve la que recibe. Un relleno suave y natural.",
  },
  "reflector-silver": {
    id: "reflector-silver",
    label: "Reflector plateado",
    nature: "reflector",
    shape: "round",
    width: 1.1,
    height: 1.1,
    beamDeg: 70,
    penumbra: 0.7,
    efficiencyEv: 0,
    areaShare: 0.1,
    fullOutput: 0,
    reflectance: 0.85,
    tint: "#f2f6ff",
    hint: "Rebote más intenso y contrastado que el blanco.",
  },
  "reflector-gold": {
    id: "reflector-gold",
    label: "Reflector dorado",
    nature: "reflector",
    shape: "round",
    width: 1.1,
    height: 1.1,
    beamDeg: 70,
    penumbra: 0.7,
    efficiencyEv: 0,
    areaShare: 0.1,
    fullOutput: 0,
    reflectance: 0.75,
    tint: "#ffc46b",
    hint: "Rebote cálido: simula sol de atardecer sobre la piel.",
  },
};

export const MODIFIER_GROUPS: { label: string; ids: ModifierId[] }[] = [
  { label: "Luz dura", ids: ["bare", "grid", "snoot", "beauty-dish", "ring"] },
  { label: "Luz suave", ids: ["softbox-small", "softbox-large", "octabox", "stripbox", "umbrella-white"] },
  { label: "Luz continua", ids: ["led-panel", "fresnel"] },
  { label: "Rebotes", ids: ["reflector-white", "reflector-silver", "reflector-gold"] },
];

export interface GelSpec {
  id: string;
  label: string;
  color: string;
  /** Luz que absorbe el gel (EV). */
  lossEv: number;
}

export const GELS: GelSpec[] = [
  { id: "none", label: "Sin gel", color: "#ffffff", lossEv: 0 },
  { id: "cto-half", label: "CTO ½ (cálido)", color: "#ffd9b0", lossEv: -0.3 },
  { id: "cto", label: "CTO (tungsteno)", color: "#ffb46b", lossEv: -0.7 },
  { id: "ctb", label: "CTB (azul día)", color: "#9dc4ff", lossEv: -1 },
  { id: "red", label: "Rojo", color: "#ff3b3b", lossEv: -2 },
  { id: "amber", label: "Ámbar", color: "#ffa21f", lossEv: -1 },
  { id: "teal", label: "Verde azulado", color: "#22d3c5", lossEv: -1.5 },
  { id: "blue", label: "Azul", color: "#3b6bff", lossEv: -2 },
  { id: "magenta", label: "Magenta", color: "#f13bd8", lossEv: -1.5 },
  { id: "green", label: "Verde", color: "#3bff6b", lossEv: -1.5 },
];

export function gelById(id: string): GelSpec {
  return GELS.find((g) => g.id === id) ?? GELS[0];
}

export const POWER_LABELS = ["1/1", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64", "1/128"];

/** Etiqueta de potencia estilo flash de estudio (admite tercios de paso). */
export function powerLabel(stops: number): string {
  const whole = Math.floor(stops + 1e-6);
  const thirds = Math.round((stops - whole) * 3);
  const base = POWER_LABELS[Math.min(whole, POWER_LABELS.length - 1)];
  if (thirds === 0) return base;
  return `${base} −${thirds}/3`;
}
