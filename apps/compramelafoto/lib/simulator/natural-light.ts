/**
 * Luz solar y hora del día — Cam Of Duty.
 *
 * TODO: clima, nubes, lluvia, niebla, nieve, tormenta, estaciones.
 */

export type TimeOfDayPresetId =
  | "dawn"
  | "morning"
  | "noon"
  | "afternoon"
  | "sunset"
  | "blue-hour"
  | "night";

export interface TimeOfDayPreset {
  id: TimeOfDayPresetId;
  label: string;
  minutes: number;
}

export const TIME_OF_DAY_PRESETS: readonly TimeOfDayPreset[] = [
  { id: "dawn", label: "Amanecer", minutes: 6 * 60 + 15 },
  { id: "morning", label: "Mañana", minutes: 9 * 60 },
  { id: "noon", label: "Mediodía", minutes: 12 * 60 + 30 },
  { id: "afternoon", label: "Tarde", minutes: 16 * 60 },
  { id: "sunset", label: "Atardecer", minutes: 19 * 60 + 15 },
  { id: "blue-hour", label: "Hora azul", minutes: 20 * 60 + 15 },
  { id: "night", label: "Noche", minutes: 22 * 60 },
];

export const DEFAULT_TIME_OF_DAY_MINUTES = 9 * 60;

export interface SunState {
  /** Minutos desde medianoche (0–1439). */
  minutes: number;
  /** Altura solar en grados (−90 … 90). */
  elevationDeg: number;
  /** Azimut en grados (0 = norte, 90 = este). */
  azimuthDeg: number;
  /** Intensidad luz direccional (0 … ~4). */
  sunIntensity: number;
  /** Color hex de la luz solar. */
  sunColor: string;
  /** Intensidad ambiente / cielo. */
  ambientIntensity: number;
  /** Color del cielo (fondo). */
  skyColor: string;
  /** Color de niebla / horizonte. */
  fogColor: string;
  /** Offset EV para fotómetro. */
  luminanceEvOffset: number;
  /** WB sugerido (K) según hora. */
  suggestedWbKelvin: number;
  /** Etiqueta pedagógica. */
  phaseLabel: string;
  /** Hay sol directo visible. */
  sunVisible: boolean;
}

const SUNRISE_MIN = 6 * 60;
const SUNSET_MIN = 19 * 60 + 30;
const SUN_DISTANCE = 45;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const ca = parse(a);
  const cb = parse(b);
  const mix = ca.map((c, i) => Math.round(lerp(c, cb[i], t)));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function clampTimeOfDayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_TIME_OF_DAY_MINUTES;
  const m = Math.round(minutes);
  return ((m % 1440) + 1440) % 1440;
}

export function formatTimeOfDay(minutes: number): string {
  const m = clampTimeOfDayMinutes(minutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Posición mundial de la luz direccional (sol). */
export function sunPositionFromState(state: SunState): [number, number, number] {
  const elev = (state.elevationDeg * Math.PI) / 180;
  const az = (state.azimuthDeg * Math.PI) / 180;
  const cosE = Math.cos(elev);
  return [
    SUN_DISTANCE * cosE * Math.sin(az),
    SUN_DISTANCE * Math.sin(elev),
    SUN_DISTANCE * cosE * Math.cos(az),
  ];
}

/**
 * Calcula estado solar a partir de minutos (00:00–23:59).
 * Curva simplificada: amanecer ~06:15, mediodía ~12:30, atardecer ~19:15.
 */
export function computeSunState(minutes: number): SunState {
  const m = clampTimeOfDayMinutes(minutes);
  const hour = m / 60;

  const dayProgress = clamp01((m - SUNRISE_MIN) / (SUNSET_MIN - SUNRISE_MIN));
  const elevationDeg =
    m < SUNRISE_MIN - 45 || m > SUNSET_MIN + 45
      ? -12
      : Math.sin(dayProgress * Math.PI) * 62 - (m < SUNRISE_MIN ? 8 : m > SUNSET_MIN ? 8 : 0);

  const azimuthDeg = lerp(75, 285, dayProgress);

  const sunVisible = elevationDeg > 2;

  let phaseLabel = "Noche";
  let sunColor = "#8899bb";
  let skyColor = "#0a1020";
  let fogColor = "#12182a";
  let sunIntensity = 0;
  let ambientIntensity = 0.22;
  let luminanceEvOffset = -2.4;
  let suggestedWbKelvin = 4200;

  if (sunVisible) {
    const heightNorm = clamp01(elevationDeg / 55);
    if (heightNorm < 0.22) {
      phaseLabel = m < 12 * 60 ? "Amanecer" : "Atardecer";
      sunColor = lerpColor("#ff6b35", "#ffd4a8", heightNorm / 0.22);
      skyColor = lerpColor("#ff9a6c", "#87b8e8", heightNorm / 0.22);
      fogColor = lerpColor("#c87850", "#a8c8e8", heightNorm / 0.22);
      sunIntensity = lerp(0.6, 2.2, heightNorm / 0.22);
      ambientIntensity = lerp(0.35, 0.65, heightNorm / 0.22);
      luminanceEvOffset = lerp(-0.5, 1.2, heightNorm / 0.22);
      suggestedWbKelvin = Math.round(lerp(3200, 5200, heightNorm / 0.22));
    } else if (heightNorm > 0.78) {
      phaseLabel = "Mediodía";
      sunColor = "#fff8ee";
      skyColor = "#6eb5ff";
      fogColor = "#9ec8f0";
      sunIntensity = 3.2;
      ambientIntensity = 0.85;
      luminanceEvOffset = 2.1;
      suggestedWbKelvin = 5800;
    } else {
      phaseLabel = heightNorm < 0.5 ? "Mañana" : "Tarde";
      sunColor = lerpColor("#ffe8c8", "#fff6ee", (heightNorm - 0.22) / 0.56);
      skyColor = lerpColor("#87b8e8", "#6eb5ff", (heightNorm - 0.22) / 0.56);
      fogColor = "#a8c8e8";
      sunIntensity = lerp(2.0, 3.0, (heightNorm - 0.22) / 0.56);
      ambientIntensity = lerp(0.55, 0.8, (heightNorm - 0.22) / 0.56);
      luminanceEvOffset = lerp(0.8, 1.8, (heightNorm - 0.22) / 0.56);
      suggestedWbKelvin = Math.round(lerp(5200, 6000, (heightNorm - 0.22) / 0.56));
    }
  } else if (hour >= 19 && hour < 21) {
    phaseLabel = "Hora azul";
    sunColor = "#6a88c8";
    skyColor = "#1a2848";
    fogColor = "#243058";
    sunIntensity = 0.08;
    ambientIntensity = 0.28;
    luminanceEvOffset = -1.2;
    suggestedWbKelvin = 7500;
  } else {
    phaseLabel = "Noche";
    sunColor = "#6688aa";
    skyColor = "#080c18";
    fogColor = "#101828";
    sunIntensity = 0;
    ambientIntensity = 0.18;
    luminanceEvOffset = -2.8;
    suggestedWbKelvin = 4000;
  }

  return {
    minutes: m,
    elevationDeg,
    azimuthDeg,
    sunIntensity,
    sunColor,
    ambientIntensity,
    skyColor,
    fogColor,
    luminanceEvOffset,
    suggestedWbKelvin,
    phaseLabel,
    sunVisible,
  };
}

export function presetToMinutes(presetId: TimeOfDayPresetId): number {
  const preset = TIME_OF_DAY_PRESETS.find((p) => p.id === presetId);
  return preset?.minutes ?? DEFAULT_TIME_OF_DAY_MINUTES;
}
