/**
 * El documento declara milímetros cuando el medio es PRINT y píxeles cuando es SCREEN.
 * El maquetado trabaja siempre en puntos PDF (1/72 de pulgada), que es la unidad de pdf-lib.
 */

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
/** Densidad de referencia de CSS: 96 px equivalen a una pulgada. */
const CSS_PX_PER_INCH = 96;

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH;
}

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToPt(px: number): number {
  return (px / CSS_PX_PER_INCH) * PT_PER_INCH;
}

export function ptToPx(pt: number, dpi: number): number {
  return (pt / PT_PER_INCH) * dpi;
}
