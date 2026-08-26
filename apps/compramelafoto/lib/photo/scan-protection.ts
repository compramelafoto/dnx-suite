/**
 * Protección visual "ventana de escaneo" para fotografías no compradas.
 *
 * La foto ampliada se muestra desenfocada y una franja horizontal recorre la
 * imagen de arriba hacia abajo revelando únicamente una sección nítida.
 *
 * Este módulo concentra la lógica pura (sin React ni DOM) para poder testearla.
 */

/**
 * Alto de la franja nítida (~6 cm en pantallas típicas).
 * clamp() la mantiene entre 128 px (móvil) y 208 px (escritorio).
 */
export const SCAN_BAND_HEIGHT_CSS = "clamp(8rem, 22vh, 13rem)";

/** Desenfoque de la capa base. Impide leer detalle sin ocultar la composición. */
export const SCAN_BASE_BLUR_CSS = "clamp(6px, 1.2vh, 11px)";

/** Velocidad del recorrido, en píxeles por segundo. */
export const SCAN_SPEED_PX_PER_SECOND = 128;

/** Velocidad para `prefers-reduced-motion`: sigue recorriendo, mucho más lento. */
export const SCAN_SPEED_PX_PER_SECOND_REDUCED_MOTION = 33;

/** Límites de duración de un ciclo completo. */
export const SCAN_MIN_DURATION_MS = 2700;
export const SCAN_MAX_DURATION_MS = 24000;

/** Duración usada mientras todavía no se midió la imagen. */
export const SCAN_FALLBACK_DURATION_MS = 6000;

/** Alto estimado de la franja mientras no hay medición real del DOM. */
export const SCAN_FALLBACK_BAND_HEIGHT_PX = 176;

export interface ScanProtectionDecisionInput {
  /** La vista activa la protección (galerías de cliente, no paneles internos). */
  enabled?: boolean;
  /** El cliente ya compró esta fotografía y tiene derecho a verla sin protección. */
  purchased?: boolean;
}

/**
 * Decide si una fotografía debe mostrarse con la ventana de escaneo.
 * Solo se protege cuando la vista lo pide y la foto no está comprada.
 */
export function shouldApplyScanProtection({
  enabled = false,
  purchased = false,
}: ScanProtectionDecisionInput = {}): boolean {
  return enabled === true && purchased !== true;
}

export interface ScanDurationInput {
  /** Alto real, en píxeles, del área que ocupa la fotografía. */
  frameHeightPx: number;
  /** Alto real, en píxeles, de la franja nítida. */
  bandHeightPx: number;
  /** El usuario pidió menos movimiento. */
  reducedMotion?: boolean;
}

/**
 * Duración de un ciclo completo (la franja entra por arriba y sale por abajo).
 * Mantiene una velocidad constante para que el recorrido se sienta igual en
 * fotos verticales, horizontales y cuadradas.
 */
export function computeScanDurationMs({
  frameHeightPx,
  bandHeightPx,
  reducedMotion = false,
}: ScanDurationInput): number {
  if (!Number.isFinite(frameHeightPx) || frameHeightPx <= 0) {
    return reducedMotion ? SCAN_MAX_DURATION_MS : SCAN_FALLBACK_DURATION_MS;
  }

  const band = Number.isFinite(bandHeightPx) && bandHeightPx > 0 ? bandHeightPx : 0;
  const speed = reducedMotion
    ? SCAN_SPEED_PX_PER_SECOND_REDUCED_MOTION
    : SCAN_SPEED_PX_PER_SECOND;

  const travelPx = frameHeightPx + band;
  const durationMs = (travelPx / speed) * 1000;

  return Math.round(
    Math.min(SCAN_MAX_DURATION_MS, Math.max(SCAN_MIN_DURATION_MS, durationMs)),
  );
}

export interface ScanContentRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calcula el rectángulo que realmente ocupa la fotografía dentro de su caja
 * cuando se usa `object-fit: contain`.
 *
 * Sin esto la franja se dibujaría también sobre las bandas vacías que quedan a
 * los costados o arriba y abajo de la imagen.
 */
export function computeContainedRect(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): ScanContentRect {
  const invalid =
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    !Number.isFinite(boxWidth) ||
    !Number.isFinite(boxHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0;

  if (invalid) {
    const safeWidth = Number.isFinite(boxWidth) && boxWidth > 0 ? boxWidth : 0;
    const safeHeight = Number.isFinite(boxHeight) && boxHeight > 0 ? boxHeight : 0;
    return { width: safeWidth, height: safeHeight, offsetX: 0, offsetY: 0 };
  }

  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    width,
    height,
    offsetX: (boxWidth - width) / 2,
    offsetY: (boxHeight - height) / 2,
  };
}
