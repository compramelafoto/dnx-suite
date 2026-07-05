/**
 * Profundidad de campo — modelo fotográfico aproximado (lente delgada).
 * Plano de enfoque por distancia (focusDistanceM), no por objeto.
 */

import {
  DEFAULT_FOCAL_LENGTH_MM,
  FOCAL_LENGTH_PRESETS,
  type FocalLengthMm,
} from "./camera-types";
import { getActiveSensor, getSensorProfile, type SensorFormatId } from "./sensor";

export { FOCAL_LENGTH_PRESETS, type FocalLengthMm };
export { DEFAULT_FOCAL_LENGTH_MM };

/** @deprecated Usar getActiveSensor().circleOfConfusionMm */
export const COC_FULL_FRAME_MM = getActiveSensor().circleOfConfusionMm;
/** @deprecated Usar SENSOR_PROFILES.APS_C */
export const COC_APSC_MM = 0.02;
/** @deprecated Usar SENSOR_PROFILES.MFT */
export const COC_MFT_MM = 0.015;

export type SensorFormat = SensorFormatId;

export function circleOfConfusionForSensor(format: SensorFormat = "FULL_FRAME"): number {
  return getSensorProfile(format).circleOfConfusionMm;
}

/** Calibración visual (no sustituye la óptica; afina la percepción en pantalla). */
export const DOF_BLUR_STRENGTH = 1.0;
/** 0 = transición más corta; 1 = rampa CoC muy gradual (más realista). */
export const DOF_TRANSITION_SOFTNESS = 0.94;
/** Curvas delante/detrás del plano de enfoque (~1 = casi simétrico y suave). */
export const DOF_FRONT_FALLOFF = 1.08;
export const DOF_BACK_FALLOFF = 1.08;

/** Por encima de este f-number el postproceso DOF en vivo se omite (casi todo nítido). */
export const DOF_SKIP_APERTURE = 16;

export interface DofParams {
  focusDistanceM: number;
  aperture: number;
  focalLengthMm: number;
  circleOfConfusionMm?: number;
}

export interface DepthOfFieldLimits {
  nearLimitM: number;
  farLimitM: number;
  depthOfFieldM: number;
  hyperfocalM: number;
}

/** @deprecated Usar DepthOfFieldLimits */
export interface DofLimits {
  nearM: number;
  farM: number;
}

export interface DefocusParams {
  subjectDistanceM: number;
  focusDistanceM: number;
  nearLimitM: number;
  farLimitM: number;
  aperture: number;
  focalLengthMm: number;
  circleOfConfusionMm?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Curva suave 0…1 entre dos umbrales. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function focalLengthM(focalLengthMm: number): number {
  return Math.max(0.001, focalLengthMm) / 1000;
}

/**
 * H = f² / (N · c) + f
 * f y c en metros → H en metros.
 */
export function calculateHyperfocalDistance({
  focalLengthMm,
  aperture,
  circleOfConfusionMm = getActiveSensor().circleOfConfusionMm,
}: {
  focalLengthMm: number;
  aperture: number;
  circleOfConfusionMm?: number;
}): number {
  const f = focalLengthM(focalLengthMm);
  const c = circleOfConfusionMm / 1000;
  const N = Math.max(1, aperture);
  if (c <= 0) return Number.POSITIVE_INFINITY;
  return (f * f) / (N * c) + f;
}

/**
 * Límites near/far con lente delgada (enfoque en focusDistanceM).
 *
 * Dn = s(H − f) / (H + s − 2f)
 * Df = s(H − f) / (H − s)   si s < H; si no, ∞
 */
export function calculateDepthOfFieldLimits({
  focusDistanceM,
  focalLengthMm,
  aperture,
  circleOfConfusionMm = getActiveSensor().circleOfConfusionMm,
}: {
  focusDistanceM: number;
  focalLengthMm: number;
  aperture: number;
  circleOfConfusionMm?: number;
}): DepthOfFieldLimits {
  const f = focalLengthM(focalLengthMm);
  const s = Math.max(f * 1.01, focusDistanceM);
  const H = calculateHyperfocalDistance({ focalLengthMm, aperture, circleOfConfusionMm });
  const HminusF = Math.max(1e-6, H - f);

  const denomNear = H + s - 2 * f;
  const nearLimitM =
    denomNear > 1e-4 ? Math.max(0.1, (s * HminusF) / denomNear) : s * 0.5;

  let farLimitM: number;
  if (s >= H - 1e-4) {
    farLimitM = Number.POSITIVE_INFINITY;
  } else {
    const denomFar = H - s;
    farLimitM = denomFar > 1e-4 ? (s * HminusF) / denomFar : Number.POSITIVE_INFINITY;
  }

  const depthOfFieldM =
    Number.isFinite(farLimitM) ? Math.max(0, farLimitM - nearLimitM) : Number.POSITIVE_INFINITY;

  return { nearLimitM, farLimitM, depthOfFieldM, hyperfocalM: H };
}

/**
 * Diámetro del círculo de confusión en el plano del sujeto (mm).
 * c = f² · |s − d| / (N · d · |s − f|)
 */
export function calculateCircleOfConfusionDiameterMm({
  subjectDistanceM,
  focusDistanceM,
  focalLengthMm,
  aperture,
}: {
  subjectDistanceM: number;
  focusDistanceM: number;
  focalLengthMm: number;
  aperture: number;
}): number {
  const f = Math.max(1, focalLengthMm);
  const s = Math.max(0.3, focusDistanceM) * 1000;
  const d = Math.max(0.15, subjectDistanceM) * 1000;
  const N = Math.max(1, aperture);
  const denom = N * d * Math.abs(s - f);
  if (denom < 1e-4) return 0;
  return (f * f * Math.abs(s - d)) / denom;
}

/**
 * Cantidad de desenfoque normalizada 0 (nítido) … 1 (máximo).
 * Solo CoC + rampa suave (sin “zona muerta” artificial dentro del DoF).
 */
export function calculateDefocusAmount({
  subjectDistanceM,
  focusDistanceM,
  nearLimitM: _nearLimitM,
  farLimitM: _farLimitM,
  aperture,
  focalLengthMm,
  circleOfConfusionMm = getActiveSensor().circleOfConfusionMm,
}: DefocusParams): number {
  const coc = calculateCircleOfConfusionDiameterMm({
    subjectDistanceM,
    focusDistanceM,
    focalLengthMm,
    aperture,
  });

  const cocNorm = coc / Math.max(1e-6, circleOfConfusionMm);

  const softLow = 0.04 * (1 - DOF_TRANSITION_SOFTNESS * 0.35);
  const softHigh = 1.35 + DOF_TRANSITION_SOFTNESS * 1.15;

  let amount = smoothstep(softLow, softHigh, cocNorm);

  const isInFront = subjectDistanceM < focusDistanceM;
  if (isInFront) {
    amount = 1 - (1 - amount) ** DOF_FRONT_FALLOFF;
  } else {
    amount = 1 - (1 - amount) ** (1 / Math.max(0.5, DOF_BACK_FALLOFF));
  }

  return clamp01(amount * DOF_BLUR_STRENGTH);
}

/** @deprecated Usar calculateDefocusAmount */
export function calculateFocusBlur(
  focusDistanceM: number,
  pixelDistanceM: number,
  aperture: number,
  focalLengthMm: number,
  circleOfConfusionMm = getActiveSensor().circleOfConfusionMm,
): number {
  const limits = calculateDepthOfFieldLimits({
    focusDistanceM,
    focalLengthMm,
    aperture,
    circleOfConfusionMm,
  });

  return calculateDefocusAmount({
    subjectDistanceM: pixelDistanceM,
    focusDistanceM,
    nearLimitM: limits.nearLimitM,
    farLimitM: limits.farLimitM,
    aperture,
    focalLengthMm,
    circleOfConfusionMm,
  });
}

export function calculateFocusBlurPx(
  focusDistanceM: number,
  pixelDistanceM: number,
  aperture: number,
  focalLengthMm: number,
  maxBlurPx = 14,
): number {
  return calculateFocusBlur(focusDistanceM, pixelDistanceM, aperture, focalLengthMm) * maxBlurPx;
}

/** @deprecated Usar calculateDepthOfFieldLimits */
export function computeDofLimits(
  focusDistanceM: number,
  aperture: number,
  focalLengthMm: number,
): DofLimits {
  const limits = calculateDepthOfFieldLimits({ focusDistanceM, focalLengthMm, aperture });
  return {
    nearM: limits.nearLimitM,
    farM: Number.isFinite(limits.farLimitM) ? limits.farLimitM : focusDistanceM * 4,
  };
}

/** @deprecated */
export function computeDofBlurPx(aperture: number): number {
  if (aperture >= 11) return 0.5;
  if (aperture >= 8) return 1.2;
  if (aperture >= 5.6) return 2.5;
  if (aperture >= 4) return 4;
  if (aperture >= 2.8) return 6;
  if (aperture >= 2) return 8;
  return 11;
}

export function formatFarDofLimit(farLimitM: number): string {
  return Number.isFinite(farLimitM) ? `${farLimitM.toFixed(2)} m` : "∞";
}

export function buildDofPedagogyNotes(aperture: number, focalLengthMm: number): string[] {
  const notes: string[] = [];
  if (aperture <= 2.8) {
    notes.push("Poca profundidad de campo (diafragma abierto)");
  } else if (aperture >= 11) {
    notes.push("Amplia profundidad de campo");
  }
  if (focalLengthMm >= 85) {
    notes.push("Teleobjetivo: menos profundidad de campo a igual diafragma");
  } else if (focalLengthMm <= 35) {
    notes.push("Gran angular: más profundidad de campo a igual diafragma");
  }
  return notes;
}
