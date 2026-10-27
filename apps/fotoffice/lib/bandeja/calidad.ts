/**
 * ¿Alcanzan los píxeles de una foto para imprimirla en una medida? (etapa 2 del bot de WhatsApp).
 * 300 dpi es lo ideal y 150 dpi el piso aceptable. Se compara lado corto con lado corto, así que
 * la orientación no importa. Módulo PURO.
 */

export type Calidad = "ideal" | "aceptable" | "insuficiente";

/** Medidas reales en milímetros (lado corto, lado largo). */
export const MEDIDAS_MM: Record<string, [number, number]> = {
  "10x15": [102, 152],
  "13x18": [127, 180],
  "15x20": [152, 203],
  "15x21": [152, 210],
  "20x30": [203, 300],
  "25x38": [254, 380],
  "30x40": [300, 400],
  "30x45": [300, 450],
};

const DPI_IDEAL = 300;
const DPI_MINIMO = 150;

function alcanza(corto: number, largo: number, [mmCorto, mmLargo]: [number, number], dpi: number): boolean {
  return corto >= Math.ceil((mmCorto / 25.4) * dpi) && largo >= Math.ceil((mmLargo / 25.4) * dpi);
}

export function calidadParaMedida(ancho: number, alto: number, medida: string): Calidad | null {
  const mm = MEDIDAS_MM[medida];
  if (!mm) return null;
  const corto = Math.min(ancho, alto);
  const largo = Math.max(ancho, alto);
  if (alcanza(corto, largo, mm, DPI_IDEAL)) return "ideal";
  if (alcanza(corto, largo, mm, DPI_MINIMO)) return "aceptable";
  return "insuficiente";
}

/** Medidas con calidad aceptable o mejor, en el orden de la tabla. */
export function medidasQueAlcanzan(ancho: number, alto: number): string[] {
  return Object.keys(MEDIDAS_MM).filter((m) => calidadParaMedida(ancho, alto, m) !== "insuficiente");
}
