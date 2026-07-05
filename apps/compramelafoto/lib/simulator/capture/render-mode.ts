/**
 * Modo de render en captura — preview tiempo real vs calidad premium.
 * Path tracing reservado solo para captura (fase 5, sin implementar).
 */

import type { SimulatorSceneId } from "../scenes";
import { usesPhotographicPipeline } from "../render/render-profile";

export type SimulatorRenderMode = "realtime" | "path-trace";

export interface CaptureRenderPlan {
  /** Modo durante vista previa / live view. */
  previewMode: SimulatorRenderMode;
  /** Modo al disparar captura. */
  captureMode: SimulatorRenderMode;
  /** Muestras PT cuando captureMode === path-trace. */
  pathTraceSamples: number;
  /** Resolución de captura relativa al viewport (1 = nativo). */
  captureScale: number;
}

const REALTIME_ONLY: CaptureRenderPlan = {
  previewMode: "realtime",
  captureMode: "realtime",
  pathTraceSamples: 0,
  captureScale: 1,
};

const PHOTOGRAPHIC_CAPTURE_PLAN: CaptureRenderPlan = {
  previewMode: "realtime",
  captureMode: "path-trace",
  pathTraceSamples: 64,
  captureScale: 1.5,
};

export function resolveCaptureRenderPlan(sceneId: SimulatorSceneId): CaptureRenderPlan {
  return usesPhotographicPipeline(sceneId) ? PHOTOGRAPHIC_CAPTURE_PLAN : REALTIME_ONLY;
}

/**
 * Indica si la captura activa debe usar path tracing.
 * Hoy siempre false hasta integrar motor PT en CanvasPhotoCapture.
 */
export function shouldUsePathTraceForCapture(
  sceneId: SimulatorSceneId,
  captureActive: boolean,
): boolean {
  if (!captureActive) return false;
  const plan = resolveCaptureRenderPlan(sceneId);
  return plan.captureMode === "path-trace";
}
