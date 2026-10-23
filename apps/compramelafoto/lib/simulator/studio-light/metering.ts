/**
 * Fotómetro del Estudio de luz.
 *
 * Unidad común ("N²"): la exposición que una luz produce sobre el sujeto se
 * expresa como el cuadrado del número f correcto a ISO 100. Así un flash y
 * una luz continua se suman en la misma escala:
 * - Flash: N² = GN² · potencia / d² (no depende del obturador).
 * - Continua: N² = lux · t · ISO / 250 (constante de fotómetro incidente).
 * Exposición de cámara: EV = log2(N²_total · ISO/100 / f²); 0 = correcta.
 */

import { FLASH_SYNC_SPEED, MODIFIERS, gelById } from "./modifiers";
import type { StudioLight, StudioState } from "./types";

export type Vec3 = [number, number, number];

/** Altura de los ojos del sujeto (m). */
export const SUBJECT_HEAD: Vec3 = [0, 1.62, 0];
/** Plano del fondo (m, Z). */
export const BACKDROP_Z = -2.6;
/** Constante de calibración de fotómetro incidente. */
export const INCIDENT_CONSTANT = 250;
/** Temperatura de color de un flash de estudio. */
export const FLASH_KELVIN = 5500;

const DEG = Math.PI / 180;

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function smoothstep(lo: number, hi: number, x: number): number {
  if (hi === lo) return x >= hi ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

export function lightPosition(light: StudioLight): Vec3 {
  return [light.x, light.y, light.z];
}

/** Punto al que apunta una luz. */
export function aimPoint(light: StudioLight): Vec3 {
  switch (light.aim) {
    case "hair":
      return [SUBJECT_HEAD[0], SUBJECT_HEAD[1] + 0.14, SUBJECT_HEAD[2] - 0.04];
    case "background":
      return [light.x * 0.35, 1.3, BACKDROP_Z];
    default:
      return SUBJECT_HEAD;
  }
}

/** Atenuación del borde del haz (misma curva que el SpotLight de three.js). */
export function beamFactor(light: StudioLight, point: Vec3): number {
  const spec = MODIFIERS[light.modifier];
  const axis = norm(sub(aimPoint(light), lightPosition(light)));
  const toPoint = norm(sub(point, lightPosition(light)));
  const half = (spec.beamDeg / 2) * DEG;
  const coneCos = Math.cos(half);
  const penumbraCos = Math.cos(half * (1 - spec.penumbra));
  return smoothstep(coneCos, penumbraCos, dot(axis, toPoint));
}

/**
 * Salida de una luz emisora en unidades N²·m² (equivale a candelas en el render).
 * Las continuas dependen del obturador; los flashes no.
 */
export function emitterOutput(light: StudioLight, shutter: number): number {
  const spec = MODIFIERS[light.modifier];
  if (spec.nature === "reflector") return 0;
  const gelLoss = gelById(light.gel).lossEv;
  const power = Math.pow(2, -light.powerStops + spec.efficiencyEv + gelLoss);
  if (spec.nature === "flash") return spec.fullOutput * spec.fullOutput * power;
  return (spec.fullOutput * power * shutter * 100) / INCIDENT_CONSTANT;
}

/** N² que una luz emisora deja en un punto, con la cara del fotómetro mirando a la luz. */
export function emitterN2At(light: StudioLight, point: Vec3, shutter: number): number {
  const d = Math.max(0.2, len(sub(point, lightPosition(light))));
  return (emitterOutput(light, shutter) * beamFactor(light, point)) / (d * d);
}

/** Luces que realmente suman (encendidas y respetando "solo"). */
export function activeLights(state: StudioState): StudioLight[] {
  const on = state.lights.filter((l) => l.on);
  const solos = on.filter((l) => l.solo);
  return solos.length > 0 ? solos : on;
}

/** Salida de un reflector: rebota lo que recibe de las luces emisoras activas. */
export function reflectorOutput(reflector: StudioLight, state: StudioState): number {
  const spec = MODIFIERS[reflector.modifier];
  if (spec.nature !== "reflector") return 0;
  const pos = lightPosition(reflector);
  const normal = norm(sub(aimPoint(reflector), pos));
  let received = 0;
  for (const l of activeLights(state)) {
    if (l.id === reflector.id || MODIFIERS[l.modifier].nature === "reflector") continue;
    const toLight = norm(sub(lightPosition(l), pos));
    const facing = Math.max(0, dot(normal, toLight));
    received += emitterN2At(l, pos, state.camera.shutter) * facing;
  }
  const area = spec.width * spec.height * (spec.shape === "round" ? Math.PI / 4 : 1);
  const directional = spec.beamDeg < 100 ? 2.4 : 1;
  return ((spec.reflectance ?? 0.6) * received * area * directional) / Math.PI;
}

/** Salida de cualquier luz del set en unidades N²·m². */
export function lightOutput(light: StudioLight, state: StudioState): number {
  return MODIFIERS[light.modifier].nature === "reflector"
    ? reflectorOutput(light, state)
    : emitterOutput(light, state.camera.shutter);
}

/** N² en el sujeto con la cara del fotómetro mirando a la luz. */
export function lightN2AtSubject(light: StudioLight, state: StudioState): number {
  const d = Math.max(0.2, len(sub(SUBJECT_HEAD, lightPosition(light))));
  return (lightOutput(light, state) * beamFactor(light, SUBJECT_HEAD)) / (d * d);
}

/** Peso de una cúpula de fotómetro apuntada a la cámara (1 de frente, 0 desde atrás). */
export function domeWeight(light: StudioLight, state: StudioState): number {
  const toCamera = norm(sub([state.camera.x, state.camera.y, state.camera.z], SUBJECT_HEAD));
  const toLight = norm(sub(lightPosition(light), SUBJECT_HEAD));
  return Math.max(0, 0.5 + 0.5 * dot(toCamera, toLight));
}

export function roomN2(state: StudioState): number {
  return (state.roomLux * state.camera.shutter * 100) / INCIDENT_CONSTANT;
}

/** Diferencia en EV entre lo que llega y lo que pide la cámara. */
export function exposureEv(n2: number, state: StudioState): number {
  if (n2 <= 0) return -Infinity;
  const { aperture, iso } = state.camera;
  return Math.log2((n2 * iso) / 100 / (aperture * aperture));
}

/** Número f que daría el fotómetro con el ISO de la cámara. */
export function fNumberFor(n2: number, iso: number): number {
  return Math.sqrt((n2 * iso) / 100);
}

export interface LightReading {
  id: string;
  n2: number;
  fNumber: number;
  ev: number;
}

export type PatternId =
  | "none"
  | "butterfly"
  | "loop"
  | "rembrandt"
  | "split"
  | "rim"
  | "underlight"
  | "top"
  | "flat";

export interface MeterReport {
  readings: LightReading[];
  /** Exposición total en la cara vista desde la cámara (EV, 0 = correcta). */
  totalEv: number;
  totalFNumber: number;
  keyId: string | null;
  /** Lectura del lado iluminado: fotómetro apuntando a la luz principal (EV). */
  keyEv: number;
  /** Relación luz/sombra (por ejemplo 3 = 3:1). null si no hay relleno medible. */
  ratio: number | null;
  pattern: PatternId;
  /** Iluminación ancha o corta, si el sujeto está girado. */
  side: "broad" | "short" | null;
  /** Fondo respecto del sujeto (EV). */
  backgroundEv: number;
  /** El obturador supera la sincronización del flash. */
  overSync: boolean;
  /** Porción del cuadro que queda negra por la cortina (0–1). */
  syncBand: number;
}

function azimuthDeg(p: Vec3): number {
  return Math.atan2(p[0], p[2]) / DEG;
}

function wrapDeg(a: number): number {
  let x = a % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

/** Clasifica el esquema por la posición de la luz principal respecto de la cara. */
export function classifyPattern(key: StudioLight | null, subjectYaw: number): PatternId {
  if (!key) return "none";
  const rel = sub(lightPosition(key), SUBJECT_HEAD);
  const az = Math.abs(wrapDeg(azimuthDeg(rel) - subjectYaw));
  const elev = Math.atan2(rel[1], Math.hypot(rel[0], rel[2])) / DEG;
  // Casi encima de la cabeza: cenital, sin importar el ángulo horizontal.
  if (elev > 62) return "top";
  if (az > 110) return "rim";
  if (elev < -12) return "underlight";
  if (az < 14) return elev > 18 ? "butterfly" : "flat";
  if (az < 36) return "loop";
  if (az < 62) return elev > 12 ? "rembrandt" : "loop";
  return "split";
}

export function meter(state: StudioState): MeterReport {
  const active = activeLights(state);
  const shutter = state.camera.shutter;
  const readings: LightReading[] = active.map((l) => {
    const n2 = lightN2AtSubject(l, state);
    return { id: l.id, n2, fNumber: fNumberFor(n2, state.camera.iso), ev: exposureEv(n2, state) };
  });

  let faceN2 = roomN2(state) * 0.6;
  let keyId: string | null = null;
  let keyFace = 0;
  let fillFace = 0;
  for (const l of active) {
    if (l.aim !== "subject") continue;
    const reading = readings.find((r) => r.id === l.id);
    const face = (reading?.n2 ?? 0) * domeWeight(l, state);
    faceN2 += face;
    if (face > keyFace) {
      fillFace += keyFace;
      keyFace = face;
      keyId = l.id;
    } else {
      fillFace += face;
    }
  }
  fillFace += roomN2(state) * 0.6;

  const backPoint: Vec3 = [0, 1.3, BACKDROP_Z];
  let backN2 = (roomN2(state) * 0.5);
  for (const l of active) {
    const spec = MODIFIERS[l.modifier];
    if (spec.nature === "reflector") continue;
    backN2 += emitterN2At(l, backPoint, shutter);
  }

  const key = active.find((l) => l.id === keyId) ?? null;
  let side: MeterReport["side"] = null;
  if (key && Math.abs(state.subjectYaw) > 8) {
    const camAz = wrapDeg(azimuthDeg(sub([state.camera.x, state.camera.y, state.camera.z], SUBJECT_HEAD)) - state.subjectYaw);
    const keyAz = wrapDeg(azimuthDeg(sub(lightPosition(key), SUBJECT_HEAD)) - state.subjectYaw);
    side = Math.sign(camAz) === Math.sign(keyAz) ? "broad" : "short";
  }

  const hasFlash = active.some((l) => MODIFIERS[l.modifier].nature === "flash");
  const overSync = hasFlash && shutter < FLASH_SYNC_SPEED - 1e-9;

  return {
    readings,
    totalEv: exposureEv(faceN2, state),
    totalFNumber: fNumberFor(faceN2, state.camera.iso),
    keyId,
    keyEv: readings.find((r) => r.id === keyId)?.ev ?? -Infinity,
    ratio: keyFace > 0 && fillFace > keyFace * 0.004 ? (keyFace + fillFace) / fillFace : null,
    pattern: classifyPattern(key, state.subjectYaw),
    side,
    backgroundEv: faceN2 > 0 && backN2 > 0 ? Math.log2(backN2 / faceN2) : -Infinity,
    overSync,
    syncBand: overSync ? Math.min(0.92, 1 - shutter / FLASH_SYNC_SPEED) : 0,
  };
}

/**
 * Multiplicador de exposición del render: con esto una luz que el fotómetro
 * marca "0 EV" deja una superficie blanca en 1.0 lineal.
 */
export function renderExposure(state: StudioState): number {
  const { aperture, iso } = state.camera;
  return (Math.PI * iso) / 100 / (aperture * aperture);
}

/** Color aproximado de un cuerpo negro (Tanner Helland), canales 0–1. */
export function kelvinToRgb(kelvin: number): Vec3 {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

function hexToRgb(hex: string): Vec3 {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Vec3;
}

/** Temperatura propia de cada luz (K). */
export function lightKelvin(light: StudioLight): number {
  if (light.modifier === "led-panel") return light.kelvin;
  if (light.modifier === "fresnel") return 3200;
  return FLASH_KELVIN;
}

/**
 * Color con que la luz se ve en la foto: gel × temperatura, corregido por el
 * balance de blancos de la cámara. Devuelve canales lineales (pueden pasar de 1).
 */
export function renderedLightColor(light: StudioLight, cameraWb: number): Vec3 {
  const spec = MODIFIERS[light.modifier];
  const gel = hexToRgb(spec.nature === "reflector" ? (spec.tint ?? "#ffffff") : gelById(light.gel).color);
  const source = kelvinToRgb(spec.nature === "reflector" ? FLASH_KELVIN : lightKelvin(light));
  const wb = kelvinToRgb(cameraWb);
  const raw: Vec3 = [0, 1, 2].map((i) => (gel[i] * source[i]) / Math.max(0.05, wb[i])) as Vec3;
  const lum = 0.2126 * raw[0] + 0.7152 * raw[1] + 0.0722 * raw[2];
  const gelLum = 0.2126 * gel[0] + 0.7152 * gel[1] + 0.0722 * gel[2];
  // Conservamos la luminancia del gel: la pérdida de luz ya está en lossEv.
  const k = lum > 0 ? Math.max(gelLum, 0.35) / lum : 1;
  return [raw[0] * k, raw[1] * k, raw[2] * k];
}

const FULL_STOPS = ["1", "1.4", "2", "2.8", "4", "5.6", "8", "11", "16", "22", "32", "45", "64", "90"];

/** Lectura estilo fotómetro de mano: diafragma entero + décimas de paso ("f/8 +3"). */
export function formatFNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1) return "< f/1";
  const stops = Math.log2(n * n);
  let whole = Math.floor(stops + 1e-6);
  let tenths = Math.round((stops - whole) * 10);
  if (tenths === 10) {
    whole += 1;
    tenths = 0;
  }
  if (whole >= FULL_STOPS.length) return `> f/${FULL_STOPS[FULL_STOPS.length - 1]}`;
  return tenths === 0 ? `f/${FULL_STOPS[whole]}` : `f/${FULL_STOPS[whole]} +${tenths}`;
}

export function formatEv(ev: number): string {
  if (!Number.isFinite(ev)) return "sin luz";
  const r = Math.round(ev * 10) / 10;
  if (Math.abs(r) < 0.05) return "0 EV";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1).replace(".", ",")} EV`;
}

export function formatShutter(t: number): string {
  if (t >= 1) return `${t}"`;
  return `1/${Math.round(1 / t)}`;
}
