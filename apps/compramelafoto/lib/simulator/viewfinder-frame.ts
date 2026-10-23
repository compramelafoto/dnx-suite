import { getActiveSensor } from "./sensor";

/**
 * Márgenes mínimos del visor (lugar para la barra superior y los datos de
 * abajo). Arriba y abajo son iguales para que el centro del recuadro sea el
 * eje óptico de la cámara 3D, como en una cámara real.
 */
export const VIEWFINDER_INSET_X = 0.08;
export const VIEWFINDER_INSET_TOP = 0.14;
export const VIEWFINDER_INSET_BOTTOM = 0.14;

/** @deprecated Usar VIEWFINDER_INSET_X — conservado para compatibilidad CSS legacy */
export const VIEWFINDER_FRAME_INSET = `${VIEWFINDER_INSET_X * 100}%`;

export interface ViewfinderCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewfinderInsets {
  /** Fracción del ancho a cada lado. */
  x: number;
  /** Fracción del alto arriba y abajo. */
  top: number;
  bottom: number;
}

/** Proporción del sensor (36×24 mm = 3:2). */
function sensorAspect(): number {
  const sensor = getActiveSensor();
  return sensor.widthMm / sensor.heightMm;
}

/**
 * Recuadro de captura con la proporción del sensor, centrado en el canvas y
 * lo más grande posible dentro de los márgenes mínimos.
 */
export function computeViewfinderInsets(canvasWidth: number, canvasHeight: number): ViewfinderInsets {
  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  const availW = w * (1 - 2 * VIEWFINDER_INSET_X);
  const availH = h * (1 - VIEWFINDER_INSET_TOP - VIEWFINDER_INSET_BOTTOM);
  const aspect = sensorAspect();
  const frameW = Math.min(availW, availH * aspect);
  const frameH = frameW / aspect;
  const x = (w - frameW) / 2 / w;
  const y = (h - frameH) / 2 / h;
  return { x, top: y, bottom: y };
}

export function getViewfinderCropRect(
  canvasWidth: number,
  canvasHeight: number,
): ViewfinderCropRect {
  const insets = computeViewfinderInsets(canvasWidth, canvasHeight);
  const x = Math.round(canvasWidth * insets.x);
  const y = Math.round(canvasHeight * insets.top);
  const width = Math.max(1, Math.round(canvasWidth * (1 - 2 * insets.x)));
  const height = Math.max(1, Math.round(canvasHeight * (1 - insets.top - insets.bottom)));
  return { x, y, width, height };
}

/**
 * Alto (mm) que abarca el canvas entero si el recuadro de captura es el
 * sensor: la cámara 3D usa este valor para el ángulo de visión, así el
 * recuadro muestra exactamente lo que ve un objetivo en full frame.
 */
export function canvasSensorHeightMm(canvasWidth: number, canvasHeight: number): number {
  const insets = computeViewfinderInsets(canvasWidth, canvasHeight);
  return getActiveSensor().heightMm / Math.max(1e-6, 1 - insets.top - insets.bottom);
}

/** Pasa un punto del recuadro (−1…1) a coordenadas del canvas entero (−1…1). */
export function frameNdcToCanvasNdc(
  ndcX: number,
  ndcY: number,
  canvasWidth: number,
  canvasHeight: number,
): [number, number] {
  const insets = computeViewfinderInsets(canvasWidth, canvasHeight);
  return [ndcX * (1 - 2 * insets.x), ndcY * (1 - insets.top - insets.bottom)];
}

export function cropCanvasToViewfinderFrame(
  source: HTMLCanvasElement,
  quality = 0.9,
): string {
  const rect = getViewfinderCropRect(source.width, source.height);
  const out = document.createElement("canvas");
  out.width = rect.width;
  out.height = rect.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL("image/jpeg", quality);
  ctx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  return out.toDataURL("image/jpeg", quality);
}

/** Convierte coordenadas de píxel del canvas completo al espacio de la captura recortada. */
export function fullCanvasPixelToCapturePixel(
  px: number,
  py: number,
  fullWidth: number,
  fullHeight: number,
  captureWidth: number,
  captureHeight: number,
): { x: number; y: number } {
  const crop = getViewfinderCropRect(fullWidth, fullHeight);
  const scaleX = captureWidth / crop.width;
  const scaleY = captureHeight / crop.height;
  return {
    x: (px - crop.x) * scaleX,
    y: (py - crop.y) * scaleY,
  };
}
