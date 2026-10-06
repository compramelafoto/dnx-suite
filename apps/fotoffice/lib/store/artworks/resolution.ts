/** Qué formatos de impresión admite una foto según su resolución. Módulo PURO. */

export type PrintFormat = { widthCm: number; heightCm: number };
export type OriginalSize = { width: number; height: number };

const CM_POR_PULGADA = 2.54;
const TOLERANCIA_PROPORCION = 0.02;

/** Lado mayor (en píxeles) que hace falta para imprimir el formato a `minDpi`. */
export function minLongSidePx(format: PrintFormat, minDpi: number): number {
  return Math.ceil((Math.max(format.widthCm, format.heightCm) / CM_POR_PULGADA) * minDpi);
}

/** Los formatos que el original alcanza a cubrir (lado mayor ≥ el mínimo). */
export function eligibleFormats<T extends PrintFormat>(original: OriginalSize, formats: readonly T[], minDpi: number): T[] {
  const lado = Math.max(original.width, original.height);
  return formats.filter((f) => lado >= minLongSidePx(f, minDpi));
}

function proporcion(a: number, b: number): number {
  return Math.max(a, b) / Math.min(a, b);
}

/** True si la proporción de la foto difiere de la del formato en más de 2 % (queda con bordes o recorte). */
export function needsBorders(original: OriginalSize, format: PrintFormat): boolean {
  const a = proporcion(original.width, original.height);
  const b = proporcion(format.widthCm, format.heightCm);
  return Math.abs(a - b) / b > TOLERANCIA_PROPORCION;
}
