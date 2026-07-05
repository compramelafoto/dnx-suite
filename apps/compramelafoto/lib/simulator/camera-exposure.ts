/**
 * Lógica de exposición fotográfica — Cam Of Duty.
 *
 * Modelo EV (referencia ISO 100):
 *   EV100 = log₂(N² / t)     — N = diafragma, t = tiempo de exposición (s)
 *   EV    = EV100 − log₂(ISO / 100)
 *
 * Referencia pedagógica de escena neutra:
 *   ISO 400 · 1/250 s · f/2.8 → fotómetro en 0 EV (sceneLuminanceEv = 0)
 *
 * Multiplicador de render (luminancia relativa):
 *   k × 2^(sceneLuminanceEv) × (ISO/ISO_ref) × (t/t_ref) × (N_ref/N)²
 *   donde k = SCENE_RENDER_CALIBRATION
 *
 * Modo M: la compensación de exposición NO altera imagen ni captura; solo el fotómetro.
 * Modos A/S: la compensación altera el autoajuste y por tanto LIVE VIEW y captura.
 */

import { shutterSpeedToSeconds } from "./camera-math";
import { computeSunState } from "./natural-light";
import { estimateSceneLuminanceForScene } from "./scene-luminance";
import type { SimulatorSceneId } from "./scenes";
import type { SunState } from "./natural-light";
import { defaultCompare, stepOption } from "./param-step";
import { simulatorRuntime } from "./simulator-runtime";
import type { CameraState } from "./camera-types";
import {
  APERTURE_PRESETS,
  REFERENCE_CAMERA,
  SHUTTER_PRESETS,
  type ExposureVerdict,
} from "./camera-types";

export type ViewfinderMode = "live-view" | "dslr-view";
export type CompositionGuideMode = "none" | "thirds" | "center";

/**
 * Calibración del render 3D: con ajustes de referencia y sceneLuminanceEv = 0
 * la escena se ve con exposición neutra (ni quemada ni negra).
 */
export const SCENE_RENDER_CALIBRATION = 4;

/** Visor óptico DSLR: brillo fijo tipo ojo humano (solo luminancia de escena). */
export function computeDslrViewfinderExposureMultiplier(sceneLuminanceEv: number): number {
  return SCENE_RENDER_CALIBRATION * Math.pow(2, sceneLuminanceEv);
}

/** @deprecated El visor óptico ya no usa boost de exposición de cámara. */
export const DSLR_VIEWFINDER_BOOST = Math.pow(2, 1.5);

/** @deprecated Usar SCENE_RENDER_CALIBRATION × DSLR_VIEWFINDER_BOOST en referencia */
export const DSLR_VIEWFINDER_EXPOSURE = SCENE_RENDER_CALIBRATION * DSLR_VIEWFINDER_BOOST;

const REF_SHUTTER_SEC = shutterSpeedToSeconds(REFERENCE_CAMERA.shutterSpeed);

/** EV de referencia (ISO 400 · 1/250 · f/2.8). */
export const REFERENCE_EXPOSURE_EV = computeExposureEv(
  REFERENCE_CAMERA.iso,
  REFERENCE_CAMERA.aperture,
  REF_SHUTTER_SEC,
);

/** Limita el multiplicador del renderer WebGL (toneMappingExposure). */
export function clampRendererExposure(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return SCENE_RENDER_CALIBRATION;
  return Math.min(16384, Math.max(1 / 8192, multiplier));
}

export function resolvePreviewExposureMultiplier(): number {
  const raw = simulatorRuntime.derived?.previewExposureMultiplier ?? SCENE_RENDER_CALIBRATION;
  return Number.isFinite(raw) ? raw : SCENE_RENDER_CALIBRATION;
}

/** Ganancia relativa respecto a la calibración (1 = referencia en escena neutra). */
export function resolvePreviewExposureGain(): number {
  return clampRendererExposure(resolvePreviewExposureMultiplier()) / SCENE_RENDER_CALIBRATION;
}

export function resolvePhotoExposureGain(): number {
  const raw = simulatorRuntime.derived?.photoExposureMultiplier ?? SCENE_RENDER_CALIBRATION;
  const mult = Number.isFinite(raw) ? raw : SCENE_RENDER_CALIBRATION;
  return clampRendererExposure(mult) / SCENE_RENDER_CALIBRATION;
}

/** Ganancia activa en el frame actual (preview o captura). */
export function resolveActiveExposureGain(): number {
  if (simulatorRuntime.captureActive && simulatorRuntime.captureExposureGain != null) {
    return simulatorRuntime.captureExposureGain;
  }
  return resolvePreviewExposureGain();
}

/** @deprecated Usar DSLR_VIEWFINDER_EXPOSURE */
export const VIEWFINDER_SCENE_BOOST = DSLR_VIEWFINDER_EXPOSURE;

export type PhotoStarRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface CaptureUserInfo {
  id: number;
  name: string | null;
  email: string;
}

export interface CaptureFocusSnapshot {
  mode: string;
  distanceM: number;
  targetLabel: string;
}

export interface CaptureResult {
  id: number;
  serverId?: string;
  timestamp: number;
  settings: CameraState;
  measuredEv: number;
  verdict: ExposureVerdict;
  evLabel: string;
  previewUrl?: string;
  pedagogyNotes?: string[];
  panningMatch?: number;
  stars: PhotoStarRating;
  takenBy?: CaptureUserInfo;
  focus?: CaptureFocusSnapshot;
  zoomChangedDuringExposure?: boolean;
  startFocalLength?: number;
  endFocalLength?: number;
  viewfinderMode?: ViewfinderMode;
  sceneId?: string;
  sceneLuminanceEv?: number;
  savedToServer?: boolean;
}

export interface ExposureDebugSnapshot {
  iso: number;
  shutterSpeed: string;
  shutterSeconds: number;
  aperture: number;
  mode: CameraState["mode"];
  ev100: number;
  exposureEv: number;
  referenceExposureEv: number;
  sceneLuminanceEv: number;
  measuredEv: number;
  meterNeedleEv: number;
  relativeStops: number;
  sceneBrightnessFactor: number;
  previewExposureMultiplier: number;
  photoExposureMultiplier: number;
  viewfinderMode: ViewfinderMode;
  appliedToneMappingExposure: number | null;
}

// ---------------------------------------------------------------------------
// EV fotográfico
// ---------------------------------------------------------------------------

/** EV100 = log₂(N² / t) */
export function computeEv100(aperture: number, shutterSeconds: number): number {
  const n = Math.max(aperture, 0.5);
  const t = Math.max(shutterSeconds, 1e-9);
  return Math.log2((n * n) / t);
}

/** EV = EV100 − log₂(ISO / 100) */
export function computeExposureEv(
  iso: number,
  aperture: number,
  shutterSeconds: number,
): number {
  const safeIso = Math.max(iso, 50);
  return computeEv100(aperture, shutterSeconds) - Math.log2(safeIso / 100);
}

export function computeExposureEvFromSettings(settings: CameraState): number {
  return computeExposureEv(
    settings.iso,
    settings.aperture,
    shutterSpeedToSeconds(settings.shutterSpeed),
  );
}

/**
 * Luminancia relativa respecto a ISO 400 · 1/250 · f/2.8.
 * ∝ (ISO/ISO_ref) × (t/t_ref) × (N_ref/N)²
 */
export function computeRelativeExposureMultiplier(settings: CameraState): number {
  const isoFactor = settings.iso / REFERENCE_CAMERA.iso;
  const shutterFactor = shutterSpeedToSeconds(settings.shutterSpeed) / REF_SHUTTER_SEC;
  const apertureFactor =
    (REFERENCE_CAMERA.aperture * REFERENCE_CAMERA.aperture) /
    (settings.aperture * settings.aperture);
  const raw = isoFactor * shutterFactor * apertureFactor;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

/** Pasos de luz de la toma respecto a la referencia (positivo = imagen más brillante). */
export function computeExposureStopsRelativeToReference(settings: CameraState): number {
  return Math.log2(Math.max(computeRelativeExposureMultiplier(settings), 1e-9));
}

// ---------------------------------------------------------------------------
// Medición y fotómetro
// ---------------------------------------------------------------------------

export function clampMeterEv(ev: number): number {
  return Math.max(-3, Math.min(3, ev));
}

/** @deprecated Usar computeRelativeExposureMultiplier */
export function computeTriangleMultiplier(settings: CameraState): number {
  return computeRelativeExposureMultiplier(settings);
}

/**
 * EV de la toma respecto a la escena (positivo = sobreexpuesto).
 * measuredEv = pasos_luminancia − sceneLuminanceEv
 */
export function computeMeasuredEv(settings: CameraState, sceneLuminanceEv: number): number {
  const brightnessStops = computeExposureStopsRelativeToReference(settings);
  return clampMeterEv(brightnessStops - sceneLuminanceEv);
}

export function classifyExposure(meterEv: number): ExposureVerdict {
  if (meterEv < -0.5) return "under";
  if (meterEv > 0.5) return "over";
  return "correct";
}

export function formatCaptureEvLabel(ev: number): string {
  const rounded = Math.round(ev * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "EV 0";
  if (rounded > 0) return `EV +${rounded}`;
  return `EV ${rounded}`;
}

export function verdictLabel(verdict: ExposureVerdict): string {
  switch (verdict) {
    case "under":
      return "Subexpuesta";
    case "over":
      return "Sobreexpuesta";
    default:
      return "Exposición correcta";
  }
}

export function histogramBiasFromMeter(meterEv: number): number {
  return Math.max(-1, Math.min(1, meterEv / 3));
}

// ---------------------------------------------------------------------------
// Modos A / S — autoexposición
// ---------------------------------------------------------------------------

function nearestShutterSeconds(targetSeconds: number): string {
  let best: string = SHUTTER_PRESETS[0];
  let bestDiff = Infinity;
  for (const preset of SHUTTER_PRESETS) {
    const sec = shutterSpeedToSeconds(preset);
    const diff = Math.abs(Math.log2(sec) - Math.log2(Math.max(targetSeconds, 1e-9)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = preset;
    }
  }
  return best;
}

function nearestAperture(targetF: number): number {
  let best: number = APERTURE_PRESETS[0];
  let bestDiff = Infinity;
  for (const f of APERTURE_PRESETS) {
    const diff = Math.abs(f - targetF);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best;
}

/**
 * Resuelve ajustes efectivos según modo.
 * Objetivo EV = REFERENCE_EXPOSURE_EV + sceneLuminanceEv + compensación.
 */
export function resolveEffectiveSettings(
  settings: CameraState,
  sceneLuminanceEv: number,
): CameraState {
  const targetExposureEv =
    REFERENCE_EXPOSURE_EV + sceneLuminanceEv + settings.exposureCompensation;
  const isoLog = Math.log2(Math.max(settings.iso, 50) / 100);

  if (settings.mode === "A") {
    const logN2overT = targetExposureEv + isoLog;
    const targetSeconds =
      (settings.aperture * settings.aperture) / Math.pow(2, logN2overT);
    return {
      ...settings,
      shutterSpeed: nearestShutterSeconds(targetSeconds),
    };
  }

  if (settings.mode === "S") {
    const shutterSec = shutterSpeedToSeconds(settings.shutterSpeed);
    const logN2overT = targetExposureEv + isoLog;
    const targetN = Math.sqrt(Math.pow(2, logN2overT) * shutterSec);
    return {
      ...settings,
      aperture: nearestAperture(targetN),
    };
  }

  return settings;
}

// ---------------------------------------------------------------------------
// Multiplicadores de render y captura
// ---------------------------------------------------------------------------

function settingsForPhotoExposure(
  settings: CameraState,
  sceneLuminanceEv: number,
): CameraState {
  const effective =
    settings.mode === "M" ? settings : resolveEffectiveSettings(settings, sceneLuminanceEv);
  return { ...effective, exposureCompensation: 0 };
}

/**
 * Multiplicador de luminancia para la foto (y LIVE VIEW WYSIWYG).
 * Incluye luminancia de escena × triángulo de exposición efectivo.
 */
export function computePhotoExposureMultiplier(
  settings: CameraState,
  sceneLuminanceEv: number,
): number {
  const photoSettings = settingsForPhotoExposure(settings, sceneLuminanceEv);
  const sceneFactor = Math.pow(2, sceneLuminanceEv);
  const relativeMult = computeRelativeExposureMultiplier(photoSettings);
  return SCENE_RENDER_CALIBRATION * sceneFactor * relativeMult;
}

/** Multiplicador por fotograma (sin tiempo de obturación) para acumulación temporal. */
export function computeInstantPhotoExposureMultiplier(
  settings: CameraState,
  sceneLuminanceEv: number,
): number {
  const photoSettings = settingsForPhotoExposure(settings, sceneLuminanceEv);
  const instantSettings = {
    ...photoSettings,
    shutterSpeed: REFERENCE_CAMERA.shutterSpeed,
  };
  const sceneFactor = Math.pow(2, sceneLuminanceEv);
  const relativeMult = computeRelativeExposureMultiplier(instantSettings);
  return SCENE_RENDER_CALIBRATION * sceneFactor * relativeMult;
}

/** Ganancia de luz por tiempo de obturación respecto a la referencia (1/250 s). */
export function computeShutterExposureGain(shutterSeconds: number): number {
  return Math.max(1 / 8192, shutterSeconds / REF_SHUTTER_SEC);
}

/**
 * LIVE VIEW → misma exposición que la foto (WYSIWYG).
 * DSLR VIEW → brillo del ojo humano: solo luminancia de escena, sin ISO/tiempo/diafragma.
 */
export function computePreviewExposureMultiplier(
  settings: CameraState,
  sceneLuminanceEv: number,
  viewfinderMode: ViewfinderMode,
): number {
  if (viewfinderMode === "dslr-view") {
    return computeDslrViewfinderExposureMultiplier(sceneLuminanceEv);
  }
  return computePhotoExposureMultiplier(settings, sceneLuminanceEv);
}

/** WB digital: live view y captura. El visor óptico DSLR no aplica WB. */
export function shouldApplyWhiteBalanceToRender(
  viewfinderMode: ViewfinderMode,
  captureActive: boolean,
): boolean {
  if (captureActive) return true;
  return viewfinderMode === "live-view";
}

export function buildExposureDebugSnapshot(
  settings: CameraState,
  sceneLuminanceEv: number,
  viewfinderMode: ViewfinderMode,
  derived: {
    measuredEv: number;
    meterNeedleEv: number;
    previewExposureMultiplier: number;
    photoExposureMultiplier: number;
  },
  appliedToneMappingExposure: number | null,
): ExposureDebugSnapshot {
  const shutterSeconds = shutterSpeedToSeconds(settings.shutterSpeed);
  const exposureEv = computeExposureEv(settings.iso, settings.aperture, shutterSeconds);
  const relativeStops = computeExposureStopsRelativeToReference(settings);

  return {
    iso: settings.iso,
    shutterSpeed: settings.shutterSpeed,
    shutterSeconds,
    aperture: settings.aperture,
    mode: settings.mode,
    ev100: computeEv100(settings.aperture, shutterSeconds),
    exposureEv,
    referenceExposureEv: REFERENCE_EXPOSURE_EV,
    sceneLuminanceEv,
    measuredEv: derived.measuredEv,
    meterNeedleEv: derived.meterNeedleEv,
    relativeStops,
    sceneBrightnessFactor: Math.pow(2, sceneLuminanceEv),
    previewExposureMultiplier: derived.previewExposureMultiplier,
    photoExposureMultiplier: derived.photoExposureMultiplier,
    viewfinderMode,
    appliedToneMappingExposure,
  };
}

export function estimateSceneLuminanceEv(x: number, z: number): number {
  const sceneId = simulatorRuntime.sceneId ?? "studio";
  const sun = simulatorRuntime.sunState ?? computeSunState(simulatorRuntime.timeOfDayMinutes);
  return estimateSceneLuminanceForScene(sceneId, x, z, sun);
}

export function estimateSceneLuminanceAt(
  sceneId: SimulatorSceneId,
  x: number,
  z: number,
  sun: SunState,
): number {
  return estimateSceneLuminanceForScene(sceneId, x, z, sun);
}

export function stepShutterTowardEv(
  current: string,
  direction: -1 | 1,
): string | null {
  return stepOption(SHUTTER_PRESETS, current, direction);
}

export function stepApertureTowardEv(
  current: number,
  direction: -1 | 1,
): number | null {
  return stepOption(APERTURE_PRESETS, current, direction, defaultCompare);
}
