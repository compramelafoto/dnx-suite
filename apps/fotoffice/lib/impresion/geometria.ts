import { MM_POR_PULGADA } from "./medidas";
import type { Encuadre } from "./receta";

/** Módulo PURO. Las cuentas que tienen que dar igual en la pantalla y en el servidor. */

/** El rectángulo que ocupa una foto girada `grados` (lo mismo que calculan react-easy-crop y sharp). */
export function cajaRotada(ancho: number, alto: number, grados: number): { ancho: number; alto: number } {
  const r = (grados * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { ancho: Math.round(ancho * c + alto * s), alto: Math.round(ancho * s + alto * c) };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * De proporciones a píxeles de una caja concreta. `margen` deja píxeles libres en los bordes:
 * con un giro no múltiplo de 90°, sharp puede redondear la caja un píxel distinto y `extract`
 * fallaría por uno.
 */
export function rectanguloEnPixeles(
  e: Encuadre,
  caja: { ancho: number; alto: number },
  margen = 0,
): { left: number; top: number; width: number; height: number } {
  const W = caja.ancho - margen;
  const H = caja.alto - margen;
  const left = Math.min(Math.max(0, Math.round(e.x * caja.ancho)), W - 1);
  const top = Math.min(Math.max(0, Math.round(e.y * caja.alto)), H - 1);
  const width = Math.max(1, Math.min(W - left, Math.round(e.ancho * caja.ancho)));
  const height = Math.max(1, Math.min(H - top, Math.round(e.alto * caja.alto)));
  return { left, top, width, height };
}

/** De lo que devuelve react-easy-crop (píxeles de la vista previa girada) a proporciones. */
export function encuadreDesdePixeles(
  px: { x: number; y: number; width: number; height: number },
  caja: { ancho: number; alto: number },
): Encuadre {
  const x = clamp01(px.x / caja.ancho);
  const y = clamp01(px.y / caja.alto);
  return { x, y, ancho: clamp01(Math.min(px.width / caja.ancho, 1 - x)), alto: clamp01(Math.min(px.height / caja.alto, 1 - y)) };
}

/** Píxeles reales del original que caen en cada pulgada del papel (el lado más débil). */
export function resolucionEfectiva(px: { width: number; height: number }, mm: { anchoMm: number; altoMm: number }): number {
  return Math.round(Math.min(px.width / (mm.anchoMm / MM_POR_PULGADA), px.height / (mm.altoMm / MM_POR_PULGADA)));
}

export function avisoDeCalidad(ppp: number): "OK" | "BLANDA" | "PIXELADA" {
  if (ppp >= 200) return "OK";
  if (ppp >= 150) return "BLANDA";
  return "PIXELADA";
}

export const LADO_VISTA_PREVIA = 1600;

/**
 * La medida de la vista previa de un original (ya derecho): el lado mayor a 1600 px, sin agrandar
 * fotos chicas. `generarVistaPrevia` achica exactamente a esto, así se puede saber la medida sin
 * volver a leer el archivo.
 */
export function tamanoVistaPrevia(ancho: number, alto: number): { ancho: number; alto: number } {
  const escala = Math.min(1, LADO_VISTA_PREVIA / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}
