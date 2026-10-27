import { MARGEN_CM, SEPARACION_CM, calcularGrilla } from "@/lib/foto-carnet/medidas";
import { mmAPx } from "./medidas";

/** Módulo PURO: dónde va cada foto carnet en la hoja y por dónde se corta. */

/**
 * Tope de fotos por hoja: entran las que caben según la medida, pero nunca más de 6. Con medidas
 * chicas en una 10x15 cabían 15 o más, y una plancha así no se le entrega a nadie.
 */
export const FOTOS_CARNET_MAX = 6;

export type DisposicionCarnet = {
  pieza: { ancho: number; alto: number };
  posiciones: { left: number; top: number }[];
  lineas: { xs: number[]; ys: number[] };
};

export function disposicionCarnet(
  medida: { anchoMm: number; altoMm: number },
  hoja: { anchoMm: number; altoMm: number },
  ppp: number,
  maxTotal?: number,
): DisposicionCarnet {
  const tope = Math.min(maxTotal && maxTotal > 0 ? maxTotal : FOTOS_CARNET_MAX, FOTOS_CARNET_MAX);
  const pieza = { ancho: mmAPx(medida.anchoMm, ppp), alto: mmAPx(medida.altoMm, ppp) };
  const gap = mmAPx(SEPARACION_CM * 10, ppp);
  const g = calcularGrilla({
    sheetWidthPx: mmAPx(hoja.anchoMm, ppp),
    sheetHeightPx: mmAPx(hoja.altoMm, ppp),
    photoWidthPx: pieza.ancho,
    photoHeightPx: pieza.alto,
    marginPx: mmAPx(MARGEN_CM * 10, ppp),
    gapPx: gap,
    maxTotal: tope,
  });
  const posiciones: { left: number; top: number }[] = [];
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (let fila = 0; fila < g.rows; fila++) {
    for (let col = 0; col < g.cols; col++) {
      if (posiciones.length >= tope) break;
      const left = g.startX + col * (pieza.ancho + gap);
      const top = g.startY + fila * (pieza.alto + gap);
      posiciones.push({ left, top });
      xs.add(left); xs.add(left + pieza.ancho - 1);
      ys.add(top); ys.add(top + pieza.alto - 1);
    }
  }
  return { pieza, posiciones, lineas: { xs: [...xs].sort((a, b) => a - b), ys: [...ys].sort((a, b) => a - b) } };
}
