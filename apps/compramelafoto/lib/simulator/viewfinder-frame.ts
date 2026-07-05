/** Insets del área de captura del visor. Deben coincidir con CSS en `.cod-sim__viewport-wrap`. */
export const VIEWFINDER_INSET_X = 0.08;
export const VIEWFINDER_INSET_TOP = 0.11;
export const VIEWFINDER_INSET_BOTTOM = 0.14;

/** @deprecated Usar VIEWFINDER_INSET_X — conservado para compatibilidad CSS legacy */
export const VIEWFINDER_FRAME_INSET = `${VIEWFINDER_INSET_X * 100}%`;

export interface ViewfinderCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getViewfinderCropRect(
  canvasWidth: number,
  canvasHeight: number,
): ViewfinderCropRect {
  const x = Math.round(canvasWidth * VIEWFINDER_INSET_X);
  const y = Math.round(canvasHeight * VIEWFINDER_INSET_TOP);
  const width = Math.max(1, Math.round(canvasWidth * (1 - 2 * VIEWFINDER_INSET_X)));
  const height = Math.max(
    1,
    Math.round(canvasHeight * (1 - VIEWFINDER_INSET_TOP - VIEWFINDER_INSET_BOTTOM)),
  );
  return { x, y, width, height };
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
