/**
 * Lógica de exposición fotográfica — Cam Of Duty.
 *
 * Modelo EV (referencia ISO 100):
 *   EV100 = log₂(N² / t)     — N = diafragma, t = tiempo de exposición (s)
 *   EV    = EV100 − log₂(ISO / 100)   (EV de la cámara)
 *
 * Luz de la escena (ver scene-light.ts y metering.ts):
 *   brillo B   = EV100 de un gris medio de 0,18 unidades de render (luz absoluta)
 *   medición M = EV100 que lee el fotómetro en la imagen real del recuadro
 *
 * Imagen (LIVE VIEW y foto): píxel = render × (gris de pantalla / 0,18) × 2^(B − EV cámara)
 * Fotómetro: M − EV cámara (positivo = sobreexpuesto).
 * Modos A/S: eligen el valor automático para que EV cámara = M − compensación.
 * Modo M: la compensación sólo mueve la aguja del fotómetro.
 */

import { shutterSpeedToSeconds } from "./camera-math";
import { defaultCompare, stepOption } from "./param-step";
import { simulatorRuntime } from "./simulator-runtime";
import type { CameraState } from "./camera-types";
import {
  APERTURE_PRESETS,
  REFERENCE_CAMERA,
  SHUTTER_PRESETS,
  type ExposureVerdict,
} from "./camera-types";
import { aperturesForLens, apertureStops, exactAperture, exactIso } from "./exposure-scales";

export type ViewfinderMode = "live-view" | "dslr-view";
export type CompositionGuideMode = "none" | "thirds" | "center";

/**
 * Escala interna del multiplicador del render (la ganancia real es
 * multiplicador / SCENE_RENDER_CALIBRATION).
 */
export const SCENE_RENDER_CALIBRATION = 4;

/**
 * Valor de pantalla al que llega un gris medio bien expuesto. El pase final
 * muestra el búfer sin codificar, así que va más alto que 0,18.
 */
export const DISPLAY_MID_GREY = 0.42;

/** Luz de la escena que necesita la cámara para exponer y medir. */
export interface SceneLight {
  /** EV100 de un gris medio de 0,18 unidades de render (luz absoluta del lugar). */
  brightnessEv100: number;
  /** EV100 que lee el fotómetro en el modo elegido. */
  meteredEv100: number;
  /** EV100 al que se adapta el ojo en el visor óptico (medición de todo el cuadro). */
  eyeEv100: number;
}

/** Ganancia del render que deja un gris medio en DISPLAY_MID_GREY cuando EV cámara = B. */
function renderGain(brightnessEv100: number, cameraEv: number): number {
  return (DISPLAY_MID_GREY / 0.18) * Math.pow(2, brightnessEv100 - cameraEv);
}

/**
 * El ojo se adapta a casi todo, pero de noche ve más oscuro: por debajo de
 * EV100 7 el visor óptico pierde ~1/3 de paso por cada paso de luz.
 */
export function eyeAdaptationEv(eyeEv100: number): number {
  return eyeEv100 + Math.max(0, 7 - eyeEv100) * 0.35;
}

/** Visor óptico DSLR: lo que ve el ojo (sin ISO, tiempo ni diafragma de la cámara). */
export function computeDslrViewfinderExposureMultiplier(light: SceneLight): number {
  return SCENE_RENDER_CALIBRATION * renderGain(light.brightnessEv100, eyeAdaptationEv(light.eyeEv100));
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
  sceneBrightnessEv100: number;
  meteredEv100: number;
  measuredEv: number;
  meterNeedleEv: number;
  relativeStops: number;
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
  const n = exactAperture(Math.max(aperture, 0.5));
  const t = Math.max(shutterSeconds, 1e-9);
  return Math.log2((n * n) / t);
}

/** EV = EV100 − log₂(ISO / 100) */
export function computeExposureEv(
  iso: number,
  aperture: number,
  shutterSeconds: number,
): number {
  const safeIso = exactIso(Math.max(iso, 50));
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
  const isoFactor = exactIso(settings.iso) / exactIso(REFERENCE_CAMERA.iso);
  const shutterFactor = shutterSpeedToSeconds(settings.shutterSpeed) / REF_SHUTTER_SEC;
  const refN = exactAperture(REFERENCE_CAMERA.aperture);
  const n = exactAperture(settings.aperture);
  const apertureFactor = (refN * refN) / (n * n);
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
 * Lectura del fotómetro (positivo = sobreexpuesto): EV medido − EV de la cámara.
 * Sin límite; la aguja del visor se recorta aparte a ±3.
 */
export function computeMeasuredEv(settings: CameraState, light: SceneLight): number {
  const cameraEv = computeExposureEv(
    settings.iso,
    settings.aperture,
    shutterSpeedToSeconds(settings.shutterSpeed),
  );
  return light.meteredEv100 - cameraEv;
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

/** Diafragma más cercano (en pasos de luz) dentro del tramo del objetivo. */
function nearestAperture(targetF: number, range?: CameraState["apertureRange"]): number {
  const allowed = range ? aperturesForLens(range.maxOpen, range.minAperture) : [...APERTURE_PRESETS];
  const options = allowed.length ? allowed : [...APERTURE_PRESETS];
  const target = Math.log2(Math.max(targetF, 0.5) ** 2);
  let best = options[0];
  let bestDiff = Infinity;
  for (const f of options) {
    const diff = Math.abs(apertureStops(f) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best;
}

/**
 * Resuelve ajustes efectivos según modo.
 * Objetivo: EV de la cámara = EV medido − compensación (+1 aclara un paso).
 */
export function resolveEffectiveSettings(
  settings: CameraState,
  light: SceneLight,
): CameraState {
  const targetExposureEv = light.meteredEv100 - settings.exposureCompensation;
  const isoLog = Math.log2(exactIso(Math.max(settings.iso, 50)) / 100);

  if (settings.mode === "A") {
    const logN2overT = targetExposureEv + isoLog;
    const n = exactAperture(settings.aperture);
    const targetSeconds = (n * n) / Math.pow(2, logN2overT);
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
      aperture: nearestAperture(targetN, settings.apertureRange),
    };
  }

  return settings;
}

// ---------------------------------------------------------------------------
// Multiplicadores de render y captura
// ---------------------------------------------------------------------------

function settingsForPhotoExposure(settings: CameraState, light: SceneLight): CameraState {
  const effective = settings.mode === "M" ? settings : resolveEffectiveSettings(settings, light);
  return { ...effective, exposureCompensation: 0 };
}

/**
 * Multiplicador de luminancia para la foto (y LIVE VIEW WYSIWYG): luz
 * absoluta de la escena frente al EV de la cámara con los ajustes efectivos.
 */
export function computePhotoExposureMultiplier(settings: CameraState, light: SceneLight): number {
  const photo = settingsForPhotoExposure(settings, light);
  const cameraEv = computeExposureEv(
    photo.iso,
    photo.aperture,
    shutterSpeedToSeconds(photo.shutterSpeed),
  );
  return SCENE_RENDER_CALIBRATION * renderGain(light.brightnessEv100, cameraEv);
}

/**
 * LIVE VIEW → misma exposición que la foto (WYSIWYG).
 * DSLR VIEW → brillo del ojo humano: solo luminancia de escena, sin ISO/tiempo/diafragma.
 */
export function computePreviewExposureMultiplier(
  settings: CameraState,
  light: SceneLight,
  viewfinderMode: ViewfinderMode,
): number {
  if (viewfinderMode === "dslr-view") {
    return computeDslrViewfinderExposureMultiplier(light);
  }
  return computePhotoExposureMultiplier(settings, light);
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
  light: SceneLight,
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
    sceneBrightnessEv100: light.brightnessEv100,
    meteredEv100: light.meteredEv100,
    measuredEv: derived.measuredEv,
    meterNeedleEv: derived.meterNeedleEv,
    relativeStops,
    previewExposureMultiplier: derived.previewExposureMultiplier,
    photoExposureMultiplier: derived.photoExposureMultiplier,
    viewfinderMode,
    appliedToneMappingExposure,
  };
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
