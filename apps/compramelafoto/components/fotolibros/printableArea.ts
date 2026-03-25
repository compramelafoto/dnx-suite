import type { AlbumSpec } from "./types";
import type { FrameShape } from "./types";

/** Área donde se pueden colocar fotos: hasta el borde gris (contenido del spread, sin margen safe). */
export function getPrintableBounds(spec: AlbumSpec) {
  const { bleed, pageWidth, pageHeight } = spec;
  return {
    minX: bleed,
    minY: bleed,
    maxX: bleed + pageWidth * 2,
    maxY: bleed + pageHeight,
    width: pageWidth * 2,
    height: pageHeight,
  };
}

/** Tamaño efectivo del contenido: todas las formas usan el frame completo. */
function getContentSize(shape: FrameShape | undefined, w: number, h: number): { contentW: number; contentH: number } {
  return { contentW: w, contentH: h };
}

/** Ajusta posición y tamaño de un frame para que quede totalmente dentro del área imprimible.
 * Para formas no rectangulares (círculo, corazón, triángulo, etc.) usa el cuadrado de contenido
 * en lugar del rectángulo del frame, permitiendo mover la forma hasta donde el contenido quepa. */
export function clampFrameToPrintable(
  spec: AlbumSpec,
  x: number,
  y: number,
  w: number,
  h: number,
  shape?: FrameShape
): { x: number; y: number; width: number; height: number } {
  const { minX, minY, maxX, maxY, width: maxW, height: maxH } = getPrintableBounds(spec);
  const { contentW, contentH } = getContentSize(shape, w, h);
  const width = Math.max(20, Math.min(w, maxW));
  const height = Math.max(20, Math.min(h, maxH));
  const ox = (w - contentW) / 2;
  const oy = (h - contentH) / 2;
  const contentX = x + ox;
  const contentY = y + oy;
  const clampedContentX = Math.max(minX, Math.min(maxX - contentW, contentX));
  const clampedContentY = Math.max(minY, Math.min(maxY - contentH, contentY));
  const x2 = clampedContentX - ox;
  const y2 = clampedContentY - oy;
  return { x: x2, y: y2, width, height };
}
