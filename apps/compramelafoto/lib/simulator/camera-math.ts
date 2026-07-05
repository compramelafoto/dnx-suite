/**
 * Utilidades de cámara — tiempo de exposición, balance de blancos, FOV.
 * La lógica EV / exposición vive en camera-exposure.ts.
 */

import type { CameraState } from "./camera-types";
import { REFERENCE_CAMERA, SHUTTER_PRESET_SECONDS } from "./camera-types";
import { getActiveSensor } from "./sensor";

/** Convierte tiempo de exposición a segundos. Soporta 1/250, 2", 8", etc. */
export function shutterSpeedToSeconds(shutterSpeed: string): number {
  const trimmed = shutterSpeed.trim();

  if (trimmed in SHUTTER_PRESET_SECONDS) {
    return SHUTTER_PRESET_SECONDS[trimmed as keyof typeof SHUTTER_PRESET_SECONDS];
  }

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
  return iso / REFERENCE_CAMERA.iso;
}

const REF_SHUTTER_SEC = shutterSpeedToSeconds(REFERENCE_CAMERA.shutterSpeed);
const REF_APERTURE = REFERENCE_CAMERA.aperture;

/**
 * Multiplicador ∝ (ISO × t) / N² con compensación de exposición.
 * Para lógica EV completa ver camera-exposure.ts.
 */
export function computeRawExposureMultiplier(settings: CameraState): number {
  const isoFactor = computeIsoExposureFactor(settings.iso);
  const shutterFactor = shutterSpeedToSeconds(settings.shutterSpeed) / REF_SHUTTER_SEC;
  const apertureFactor = (REF_APERTURE * REF_APERTURE) / (settings.aperture * settings.aperture);
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

const NEUTRAL_KELVIN = 5600;

export function computeWhiteBalanceTint(kelvin: number): { r: number; g: number; b: number } {
  const target = kelvinToRgb(kelvin);
  const neutral = kelvinToRgb(NEUTRAL_KELVIN);
  return {
    r: target.r / neutral.r,
    g: target.g / neutral.g,
    b: target.b / neutral.b,
  };
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

/** FOV vertical desde distancia focal y sensor activo (Full Frame por defecto). */
export function focalLengthToFov(focalLengthMm: number): number {
  const sensor = getActiveSensor();
  const focal = Math.max(8, Math.min(600, focalLengthMm));
  const radians = 2 * Math.atan(sensor.heightMm / (2 * focal));
  return (radians * 180) / Math.PI;
}
