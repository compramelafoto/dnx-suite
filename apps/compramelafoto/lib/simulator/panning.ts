/**
 * Detección de barrido horizontal (panning) durante capturas largas.
 *
 * TODO (etapas futuras):
 * - Motion vectors reales por píxel
 * - Segmentación por objeto / máscara precisa
 * - Barrido vertical
 */

import { findMovingSubject, type MovingSubjectState } from "./moving-subject-types";
import { simulatorRuntime } from "./simulator-runtime";

/** Tiempo de exposición mínimo para evaluar barrido. */
export const PANNING_MIN_SHUTTER_SEC = 1 / 30;

/** Giro mínimo de cámara (rad) para considerar intento de barrido. */
export const PANNING_MIN_YAW_RAD = 0.012;

export interface PanningSample {
  timeMs: number;
  cameraYaw: number;
  /** Posición mundial X del sujeto (legacy). */
  subjectX: number;
  /** Posición en píxeles de captura (centro del sujeto). */
  subjectScreenX?: number;
  subjectScreenY?: number;
}

export interface PanningResult {
  /** 0 = sin seguimiento, 1 = seguimiento ideal. */
  panningMatch: number;
  detected: boolean;
  subjectFollowed: boolean;
  cameraYawDelta: number;
  subjectXDelta: number;
  /** Deriva del sujeto en pantalla (px de captura). Menor = mejor barrido. */
  subjectScreenJitterPx: number;
  /** Dirección del barrido: -1 izq, 1 der, 0 nulo. */
  panDirection: -1 | 0 | 1;
}

export function isPanningShutterEligible(shutterSeconds: number): boolean {
  return shutterSeconds >= PANNING_MIN_SHUTTER_SEC;
}

/** Sujeto activo para barrido: enfocado o primer móvil visible. */
export function resolvePanningSubject(): MovingSubjectState | null {
  const focused = findMovingSubject(
    simulatorRuntime.movingSubjects,
    simulatorRuntime.focusedObjectId,
  );
  if (focused) return focused;
  return simulatorRuntime.movingSubject;
}

/** Solo alinear acumulación si hay sujeto móvil enfocado (barrido intencional). */
export function isPanningAlignmentEligible(): boolean {
  const focusedId = simulatorRuntime.focusedObjectId;
  if (!focusedId) return false;

  const subject = findMovingSubject(simulatorRuntime.movingSubjects, focusedId);
  if (!subject?.visible) return false;

  const lateralSpeed = Math.abs(subject.velocityX ?? subject.speed * subject.direction);
  const velocity3d = subject.velocity
    ? Math.hypot(subject.velocity[0], subject.velocity[2])
    : lateralSpeed;
  return velocity3d >= 0.06;
}

/**
 * Compara rotación de cámara y estabilidad del sujeto en pantalla.
 */
export function computePanningMatch(
  samples: PanningSample[],
  subjectDepthM = 5,
  captureWidthPx = 640,
): PanningResult {
  if (samples.length < 2) {
    return emptyPanningResult();
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationSec = (last.timeMs - first.timeMs) / 1000;
  const cameraYawDelta = last.cameraYaw - first.cameraYaw;
  const subjectXDelta = last.subjectX - first.subjectX;
  const panDirection: -1 | 0 | 1 =
    cameraYawDelta > 0.008 ? 1 : cameraYawDelta < -0.008 ? -1 : 0;

  const hasScreen =
    first.subjectScreenX != null &&
    last.subjectScreenX != null &&
    Number.isFinite(first.subjectScreenX) &&
    Number.isFinite(last.subjectScreenX);

  const screenJitterPx = hasScreen
    ? Math.abs(last.subjectScreenX! - first.subjectScreenX!)
    : captureWidthPx;

  const yawAttempt = Math.abs(cameraYawDelta) >= PANNING_MIN_YAW_RAD;
  const subjectMoved = Math.abs(subjectXDelta) >= 0.12;

  if (durationSec < 0.04 || (!yawAttempt && !subjectMoved && !hasScreen)) {
    return {
      ...emptyPanningResult(),
      cameraYawDelta,
      subjectXDelta,
      subjectScreenJitterPx: screenJitterPx,
      panDirection,
    };
  }

  let panningMatch: number;

  if (hasScreen) {
    const maxJitter = Math.max(24, captureWidthPx * 0.14);
    const screenScore = Math.max(0, 1 - screenJitterPx / maxJitter);
    const depth = Math.max(1.5, subjectDepthM);
    const expectedYaw = -Math.atan2(subjectXDelta, depth);
    const yawError = Math.abs(cameraYawDelta - expectedYaw);
    const yawScore = Math.max(0, 1 - yawError / 0.45);
    panningMatch = yawAttempt ? screenScore * 0.65 + yawScore * 0.35 : screenScore * 0.4;
  } else {
    const depth = Math.max(1.5, subjectDepthM);
    const expectedYaw = -Math.atan2(subjectXDelta, depth);
    const yawError = Math.abs(cameraYawDelta - expectedYaw);
    panningMatch = Math.max(0, 1 - yawError / 0.4);
  }

  panningMatch = Math.max(0, Math.min(1, panningMatch));

  return {
    panningMatch,
    detected: yawAttempt || subjectMoved,
    subjectFollowed:
      panningMatch >= 0.52 && isPanningAlignmentEligible(),
    cameraYawDelta,
    subjectXDelta,
    subjectScreenJitterPx: screenJitterPx,
    panDirection,
  };
}

function emptyPanningResult(): PanningResult {
  return {
    panningMatch: 0,
    detected: false,
    subjectFollowed: false,
    cameraYawDelta: 0,
    subjectXDelta: 0,
    subjectScreenJitterPx: 0,
    panDirection: 0,
  };
}

export function buildPanningPedagogyNotes(result: PanningResult): string[] {
  if (!result.detected) return [];

  if (result.subjectFollowed) {
    if (result.panningMatch >= 0.75) {
      return ["Barrido logrado: sujeto nítido, fondo en movimiento", "Buen seguimiento del sujeto"];
    }
    return ["Barrido aceptable: el sujeto quedó bastante nítido", "Podés afinar el seguimiento"];
  }

  if (result.panningMatch >= 0.25) {
    return ["Barrido parcial: el sujeto no quedó totalmente nítido"];
  }

  return ["Sin barrido efectivo: sujeto y fondo movidos"];
}

/** Desplazamiento horizontal para alinear acumulación al barrer. */
export function computePanningAlignOffsetPx(
  samples: PanningSample[],
  currentScreenX: number,
  currentYaw: number,
  captureWidthPx: number,
): number {
  if (!isPanningAlignmentEligible()) return 0;
  if (samples.length === 0) return 0;

  const first = samples[0];
  const yawFromStart = currentYaw - first.cameraYaw;
  if (Math.abs(yawFromStart) < PANNING_MIN_YAW_RAD) return 0;

  const refX = first.subjectScreenX;
  if (refX == null || !Number.isFinite(refX)) return 0;

  const offset = Math.round(refX - currentScreenX);
  const maxOffset = Math.max(10, Math.floor(captureWidthPx * 0.14));
  if (Math.abs(offset) > maxOffset) return 0;

  return offset;
}
