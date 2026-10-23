/**
 * Profundidad de campo — óptica de lente delgada, como una cámara real.
 * Plano de enfoque por distancia (focusDistanceM), no por objeto.
 *
 * El desenfoque de cada punto es el diámetro del disco de desenfoque que
 * proyecta sobre el sensor, pasado a píxeles de la imagen. No hay curvas
 * de "calibración visual": cerrar un paso de diafragma achica el disco a
 * la mitad del área (diámetro ÷ √2), igual que en el estudio.
 */

import {
  DEFAULT_FOCAL_LENGTH_MM,
  FOCAL_LENGTH_PRESETS,
  type FocalLengthMm,
} from "./camera-types";
import { getActiveSensor, getSensorProfile, type SensorFormatId } from "./sensor";

export { FOCAL_LENGTH_PRESETS, type FocalLengthMm };
export { DEFAULT_FOCAL_LENGTH_MM };

export type SensorFormat = SensorFormatId;

export function circleOfConfusionForSensor(format: SensorFormat = "FULL_FRAME"): number {
  return getSensorProfile(format).circleOfConfusionMm;
}

/**
 * Tope del disco de desenfoque, como fracción del alto de la imagen.
 * Sólo existe por rendimiento: un macro a f/2.8 puede pedir discos de
 * cientos de píxeles. 7 % del alto ya es un fondo totalmente disuelto.
 */
export const DOF_MAX_BLUR_FRACTION_OF_HEIGHT = 0.07;

/** Por debajo de este diámetro (px) un punto se ve nítido en pantalla. */
export const DOF_SHARP_THRESHOLD_PX = 0.5;

/** Distancia más cercana que se considera al estimar el peor desenfoque de la escena. */
export const DOF_NEAREST_SCENE_M = 0.4;

export interface DepthOfFieldLimits {
  nearLimitM: number;
  farLimitM: number;
  depthOfFieldM: number;
  hyperfocalM: number;
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
 * Diámetro del disco de desenfoque sobre el SENSOR (mm) para un punto a
 * subjectDistanceM cuando la lente enfoca a focusDistanceM.
 *
 * b = f² · |d − s| / (N · d · (s − f))
 * Con d = ∞ queda b = f² / (N · (s − f)): el cielo también se desenfoca.
 */
export function calculateBlurDiscOnSensorMm({
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
  const s = Math.max(focusDistanceM * 1000, f * 1.01);
  const N = Math.max(1, aperture);
  if (!Number.isFinite(subjectDistanceM)) {
    return (f * f) / (N * (s - f));
  }
  const d = Math.max(0.05, subjectDistanceM) * 1000;
  return (f * f * Math.abs(d - s)) / (N * d * (s - f));
}

/** @deprecated Nombre viejo: el resultado es sobre el sensor, no sobre el sujeto. */
export const calculateCircleOfConfusionDiameterMm = calculateBlurDiscOnSensorMm;

/**
 * Diámetro del disco de desenfoque en píxeles de la imagen renderizada.
 * La cámara 3D usa FOV vertical = alto del sensor, así que el alto del
 * sensor (mm) se corresponde con el alto de la imagen (px).
 */
export function calculateBlurDiameterPx({
  subjectDistanceM,
  focusDistanceM,
  focalLengthMm,
  aperture,
  imageHeightPx,
  sensorHeightMm = getActiveSensor().heightMm,
}: {
  subjectDistanceM: number;
  focusDistanceM: number;
  focalLengthMm: number;
  aperture: number;
  imageHeightPx: number;
  sensorHeightMm?: number;
}): number {
  const discMm = calculateBlurDiscOnSensorMm({
    subjectDistanceM,
    focusDistanceM,
    focalLengthMm,
    aperture,
  });
  return (discMm / Math.max(1e-6, sensorHeightMm)) * imageHeightPx;
}

/** Tope de diámetro (px) que acepta el render para una imagen de este alto. */
export function maxRenderableBlurPx(imageHeightPx: number): number {
  return Math.max(4, imageHeightPx * DOF_MAX_BLUR_FRACTION_OF_HEIGHT);
}

/**
 * Peor desenfoque posible en la escena (px): el mayor entre el infinito y
 * un objeto muy cercano. Limita hasta dónde busca el shader.
 */
export function calculateSceneMaxBlurPx(params: {
  focusDistanceM: number;
  focalLengthMm: number;
  aperture: number;
  imageHeightPx: number;
  sensorHeightMm?: number;
}): number {
  const atInfinity = calculateBlurDiameterPx({
    ...params,
    subjectDistanceM: Number.POSITIVE_INFINITY,
  });
  const atNearest = calculateBlurDiameterPx({
    ...params,
    subjectDistanceM: Math.min(DOF_NEAREST_SCENE_M, params.focusDistanceM),
  });
  return Math.min(maxRenderableBlurPx(params.imageHeightPx), Math.max(atInfinity, atNearest));
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
