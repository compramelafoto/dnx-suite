/**
 * Lógica compartida de recorte y escalado de imagen para fotolibros.
 * Usado por CanvasEditor y por ImageFramePreview para que la vista previa coincida con el libro.
 *
 * IMPORTANTE: Zoom, rotación y recorte NUNCA deforman las proporciones del archivo original.
 * Siempre usamos escala uniforme (mismo factor en X e Y) para preservar el aspect ratio.
 */

import type { FrameItem } from "./types";

/** Relación de aspecto objetivo: marco (crop debe tener esta proporción para no deformar al escalar). */
const frameAspect = (w: number, h: number) => (h > 0 ? w / h : 1);

export function getCoverCrop(image: HTMLImageElement, frame: FrameItem, zoom = 1) {
  const imageWidth = Math.max(1, image.naturalWidth);
  const imageHeight = Math.max(1, image.naturalHeight);
  // Escala uniforme: mismo factor para ancho y alto → sin deformación
  const scale = Math.max(frame.width / imageWidth, frame.height / imageHeight) * zoom;
  let cropWidth = Math.max(1, Math.min(imageWidth, frame.width / scale));
  let cropHeight = Math.max(1, Math.min(imageHeight, frame.height / scale));
  let cropX = (imageWidth - cropWidth) / 2;
  let cropY = (imageHeight - cropHeight) / 2;
  const ox = (frame.imageOffsetX ?? 0) * (cropWidth / frame.width);
  const oy = (frame.imageOffsetY ?? 0) * (cropHeight / frame.height);
  cropX = Math.max(0, Math.min(imageWidth - cropWidth, cropX - ox));
  cropY = Math.max(0, Math.min(imageHeight - cropHeight, cropY - oy));
  cropX = Math.round(cropX);
  cropY = Math.round(cropY);
  cropWidth = Math.round(cropWidth);
  cropHeight = Math.round(cropHeight);
  // Al ajustar por bordes, mantener proporción marco (frame.w/frame.h) para no deformar
  const maxW = Math.max(1, imageWidth - cropX);
  const maxH = Math.max(1, imageHeight - cropY);
  const targetAspect = frameAspect(frame.width, frame.height);
  if (cropWidth > maxW || cropHeight > maxH) {
    if (maxW / targetAspect <= maxH) {
      cropWidth = maxW;
      cropHeight = Math.max(1, Math.round(maxW / targetAspect));
    } else {
      cropHeight = maxH;
      cropWidth = Math.max(1, Math.round(maxH * targetAspect));
    }
  }
  return { cropX, cropY, cropWidth: Math.max(1, cropWidth), cropHeight: Math.max(1, cropHeight) };
}

/**
 * Factor para que al rotar la imagen SOBRESALGA del recuadro y lo rellene por completo.
 * La imagen se amplía para que al rotar llene el marco sin triángulos blancos en las esquinas.
 * Margen generoso (15%) asegura cobertura total con el clip, especialmente en marcos no cuadrados.
 */
export function getRotationFillScale(rotationDeg: number): number {
  if (!rotationDeg) return 1;
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  if (c + s < 1e-6) return 1;
  const base = c + s;
  return base * 1.15; // margen 15% para eliminar triángulos blancos
}

/** Zoom mínimo para que la imagen rotada llene el marco (evitar encoger). Usado cuando se auto-ajusta al rotar. */
export function getRotationFillZoom(rotationDeg: number): number {
  return getRotationFillScale(rotationDeg);
}

/** Tamaño para contain: escala uniforme (mismo factor X e Y) → sin deformación. */
export function getContainSize(
  image: HTMLImageElement,
  frameWidth: number,
  frameHeight: number,
  zoom: number
) {
  const nw = Math.max(1, image.naturalWidth);
  const nh = Math.max(1, image.naturalHeight);
  const scale = Math.min(frameWidth / nw, frameHeight / nh) * zoom;
  return { width: nw * scale, height: nh * scale };
}
