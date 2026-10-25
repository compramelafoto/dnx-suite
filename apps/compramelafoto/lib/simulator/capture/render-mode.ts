/**
 * Modo de render en captura — preview tiempo real vs calidad premium.
 * Path tracing reservado solo para captura (fase 5, sin implementar).
 */

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

const PHOTOGRAPHIC_CAPTURE_PLAN: CaptureRenderPlan = {
  previewMode: "realtime",
  captureMode: "path-trace",
  pathTraceSamples: 64,
  captureScale: 1.5,
};

export function resolveCaptureRenderPlan(): CaptureRenderPlan {
  return PHOTOGRAPHIC_CAPTURE_PLAN;
}

/**
 * Indica si la captura activa debe usar path tracing.
 * Hoy siempre false hasta integrar motor PT en CanvasPhotoCapture.
 */
export function shouldUsePathTraceForCapture(captureActive: boolean): boolean {
  if (!captureActive) return false;
  const plan = resolveCaptureRenderPlan();
  return plan.captureMode === "path-trace";
}
