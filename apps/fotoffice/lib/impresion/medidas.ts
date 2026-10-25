/**
 * Medidas de impresión. Módulo PURO (lo usan el navegador y el servidor).
 * Todo se calcula desde los milímetros reales del papel, nunca desde el nombre ("10x15").
 */

export const MM_POR_PULGADA = 25.4;

export type Nitidez = "SUAVE" | "NORMAL" | "FUERTE";

export function mmAPx(mm: number, ppp: number): number {
  return Math.round((mm / MM_POR_PULGADA) * ppp);
}

export function pixelesDeHoja(t: { anchoMm: number; altoMm: number }, ppp: number): { ancho: number; alto: number } {
  return { ancho: mmAPx(t.anchoMm, ppp), alto: mmAPx(t.altoMm, ppp) };
}

/** El tamaño que se le pide al navegador para que, con la corrección, salga a la medida real. */
export function medidaImpresaMm(mm: number, escalaMil: number): number {
  return Math.round(((mm * escalaMil) / 1000) * 10) / 10;
}

/**
 * La hoja de prueba trae una regla de 100 mm. Si impresa mide 99 mm, hay que pedir un 1,0 %
 * más (1010 por mil). Fuera de 90–110 mm es un error de medición, no una corrección.
 */
export function escalaDesdeRegla(medidaImpresaMm: number): number | null {
  if (!Number.isFinite(medidaImpresaMm) || medidaImpresaMm < 90 || medidaImpresaMm > 110) return null;
  return Math.round((100 / medidaImpresaMm) * 1000);
}

export const TAMANOS_INICIALES = [
  { nombre: "10x15", anchoMm: 102, altoMm: 152, orden: 1 },
  { nombre: "13x18", anchoMm: 127, altoMm: 180, orden: 2 },
  { nombre: "15x20", anchoMm: 152, altoMm: 203, orden: 3 },
  { nombre: "15x21", anchoMm: 152, altoMm: 210, orden: 4 },
  { nombre: "20x30", anchoMm: 203, altoMm: 300, orden: 5 },
  { nombre: "25x38", anchoMm: 254, altoMm: 380, orden: 6 },
  { nombre: "A4", anchoMm: 210, altoMm: 297, orden: 7 },
] as const;

/** Las dos impresoras de DNX Estudio. Los laboratorios se agregan después desde Configuración. */
export const SALIDAS_INICIALES = [
  { nombre: "Kodak 305", ppp: 300, nitidez: "SUAVE", admiteCopias: true, tamanos: ["10x15", "13x18", "15x20"] },
  { nombre: "Epson L800", ppp: 300, nitidez: "FUERTE", admiteCopias: false, tamanos: ["10x15", "A4"] },
] as const satisfies readonly { nombre: string; ppp: number; nitidez: Nitidez; admiteCopias: boolean; tamanos: readonly string[] }[];
