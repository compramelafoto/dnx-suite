/** Resolución de referencia para impresión/export (px por pulgada). */
export const TEMPLATE_V2_EXPORT_DPI = 300;

const MM_PER_INCH = 25.4;

export type CanvasDimUnit = "px" | "cm" | "mm";

export function mmFromPx(px: number, dpi: number): number {
  return (px * MM_PER_INCH) / dpi;
}

export function pxFromMm(mm: number, dpi: number): number {
  return (mm * dpi) / MM_PER_INCH;
}

export function cmFromPx(px: number, dpi: number): number {
  return mmFromPx(px, dpi) / 10;
}

export function pxFromCm(cm: number, dpi: number): number {
  return pxFromMm(cm * 10, dpi);
}

export function pxFromUnit(value: number, unit: CanvasDimUnit, dpi: number): number {
  if (unit === "px") return value;
  if (unit === "cm") return pxFromCm(value, dpi);
  return pxFromMm(value, dpi);
}

export function formatDimForUnit(px: number, unit: CanvasDimUnit, dpi: number): string {
  if (unit === "px") return String(Math.round(px));
  if (unit === "cm") {
    const v = cmFromPx(px, dpi);
    return String(Math.round(v * 1000) / 1000);
  }
  const v = mmFromPx(px, dpi);
  return String(Math.round(v * 100) / 100);
}

export function parseDimInput(raw: string): number | null {
  const s = raw.replace(",", ".").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
