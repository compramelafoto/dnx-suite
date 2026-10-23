/**
 * Utilidades de cámara — tiempo de exposición, balance de blancos, FOV.
 * La lógica EV / exposición vive en camera-exposure.ts.
 */

import type { CameraState } from "./camera-types";
import { REFERENCE_CAMERA } from "./camera-types";
import { exactAperture, exactIso, exactShutterSeconds } from "./exposure-scales";
import { getActiveSensor } from "./sensor";

/**
 * Convierte tiempo de exposición a segundos. Soporta 1/250, 2", 0.3", 8s, etc.
 * Devuelve el tercio de paso exacto (1/125 → 1/128), como la cámara real.
 */
export function shutterSpeedToSeconds(shutterSpeed: string): number {
  return exactShutterSeconds(parseShutterSeconds(shutterSpeed));
}

function parseShutterSeconds(shutterSpeed: string): number {
  const trimmed = shutterSpeed.trim();

  const fraction = trimmed.match(/^1\/(\d+)$/);
  if (fraction) return 1 / Number(fraction[1]);

  const quotedSeconds = trimmed.match(/^(\d+(?:\.\d+)?)"$/);
  if (quotedSeconds) return Number(quotedSeconds[1]);

  const suffixedSeconds = trimmed.match(/^(\d+(?:\.\d+)?)s$/i);
  if (suffixedSeconds) return Number(suffixedSeconds[1]);

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  return 1 / 250;
}

export function computeIsoStopsFrom100(iso: number): number {
  return Math.log2(iso / 100);
}

/** Factor de exposición solo por ISO (respecto a la referencia ISO 400). */
export function computeIsoExposureFactor(iso: number): number {
  return exactIso(iso) / exactIso(REFERENCE_CAMERA.iso);
}

const REF_SHUTTER_SEC = shutterSpeedToSeconds(REFERENCE_CAMERA.shutterSpeed);
const REF_APERTURE = exactAperture(REFERENCE_CAMERA.aperture);

/**
 * Multiplicador ∝ (ISO × t) / N² con compensación de exposición.
 * Para lógica EV completa ver camera-exposure.ts.
 */
export function computeRawExposureMultiplier(settings: CameraState): number {
  const isoFactor = computeIsoExposureFactor(settings.iso);
  const shutterFactor = shutterSpeedToSeconds(settings.shutterSpeed) / REF_SHUTTER_SEC;
  const n = exactAperture(settings.aperture);
  const apertureFactor = (REF_APERTURE * REF_APERTURE) / (n * n);
  const raw = isoFactor * shutterFactor * apertureFactor;
  return raw * Math.pow(2, settings.exposureCompensation);
}

/** @deprecated Preferir computeRelativeExposureMultiplier en camera-exposure.ts */
export function computeExposureMultiplier(settings: CameraState): number {
  return computeRawExposureMultiplier(settings);
}

export function computeExposureValue(settings: CameraState): number {
  const raw = computeRawExposureMultiplier(settings);
  return Math.log2(Math.max(raw, 1e-6));
}

export function formatEvLabel(ev: number): string {
  const rounded = Math.round(ev);
  if (rounded === 0) return "EV 0";
  if (rounded > 0) return `EV +${rounded}`;
  return `EV ${rounded}`;
}

export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 1;
    g = Math.min(1, Math.max(0, (99.4708025861 * Math.log(temp) - 161.1195681661) / 255));
    b =
      temp <= 19
        ? 0
        : Math.min(1, Math.max(0, (138.5177312231 * Math.log(temp - 10) - 305.0447927307) / 255));
  } else {
    r = Math.min(1, Math.max(0, (329.698727446 * Math.pow(temp - 60, -0.1332047592)) / 255));
    g = Math.min(1, Math.max(0, (288.1221695283 * Math.pow(temp - 60, -0.0755148492)) / 255));
    b = 1;
  }

  return { r, g, b };
}

/**
 * Temperatura que la escena 3D dibuja como blanco: el blanco de sRGB es D65.
 * Una luz "#ffffff" equivale a ~6500 K.
 */
const SCENE_WHITE_KELVIN = 6500;

/**
 * Corrección del balance de blancos de la cámara, como en una cámara real:
 * la cámara divide por el color de la luz que le indicamos. Elegir 3200 K
 * con luz de día ENFRÍA la imagen (azul); elegir 7500 K la calienta. Si el
 * valor coincide con la luz de la escena, el blanco sale neutro.
 * Se normaliza a luminancia 1 para no cambiar la exposición.
 * El cociente va en valores de pantalla (sRGB): el pase final muestra el
 * búfer tal cual, igual que el JPEG de la cámara ya codificado.
 */
export function computeWhiteBalanceTint(kelvin: number): { r: number; g: number; b: number } {
  const camera = kelvinToRgb(kelvin);
  const white = kelvinToRgb(SCENE_WHITE_KELVIN);
  const ratio = (channel: "r" | "g" | "b") => white[channel] / Math.max(0.05, camera[channel]);
  const r = ratio("r");
  const g = ratio("g");
  const b = ratio("b");
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { r: r / luminance, g: g / luminance, b: b / luminance };
}

export function tintHexColor(baseHex: string, tint: { r: number; g: number; b: number }): string {
  const hex = baseHex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toByte = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v * 255)))
      .toString(16)
      .padStart(2, "0");

  return `#${toByte(r * tint.r)}${toByte(g * tint.g)}${toByte(b * tint.b)}`;
}

/**
 * FOV vertical desde distancia focal. `sensorHeightMm` es el alto que cubre
 * la imagen renderizada (ver canvasSensorHeightMm); por defecto, el sensor.
 */
export function focalLengthToFov(
  focalLengthMm: number,
  sensorHeightMm = getActiveSensor().heightMm,
): number {
  const focal = Math.max(8, Math.min(600, focalLengthMm));
  const radians = 2 * Math.atan(sensorHeightMm / (2 * focal));
  return (radians * 180) / Math.PI;
}
