/**
 * Las placas de Comunicación: qué tipos hay, en qué formatos y con qué marca se reconoce la
 * plantilla de cada combinación.
 *
 * Módulo puro: lo importan pantallas de cliente, así que no puede arrastrar la base.
 */

export const PLACA_KINDS = ["bienvenida", "socio-semana"] as const;
export type PlacaKind = (typeof PLACA_KINDS)[number];

export const PLACA_FORMATS = ["cuadrada", "historia"] as const;
export type PlacaFormat = (typeof PLACA_FORMATS)[number];

export const PLACA_KIND_LABEL: Record<PlacaKind, string> = {
  bienvenida: "Bienvenida al nuevo socio",
  "socio-semana": "Socio de la semana",
};

export const PLACA_FORMAT_LABEL: Record<PlacaFormat, string> = {
  cuadrada: "Cuadrada (publicación)",
  historia: "Historia (vertical)",
};

/** Píxeles finales de cada formato: los que pide Instagram. */
export const PLACA_FORMAT_PX: Record<PlacaFormat, { width: number; height: number }> = {
  cuadrada: { width: 1080, height: 1080 },
  historia: { width: 1080, height: 1920 },
};

/**
 * Resolución con la que se diseña y se rasteriza. El lienzo del editor está en píxeles y el
 * documento de impresión en milímetros; con el mismo dpi en los dos lados, 1080 px de lienzo son
 * 1080 px de PNG.
 */
export const PLACA_DPI = 300;

export function placaTemplateKey(kind: PlacaKind, format: PlacaFormat): string {
  return `placa-${kind}-${format}-v1`;
}

export function isPlacaTemplateKey(key: string | null | undefined): boolean {
  return typeof key === "string" && /^placa-/.test(key);
}

export function parsePlacaKind(value: unknown): PlacaKind | null {
  return (PLACA_KINDS as readonly unknown[]).includes(value) ? (value as PlacaKind) : null;
}

export function parsePlacaFormat(value: unknown): PlacaFormat | null {
  return (PLACA_FORMATS as readonly unknown[]).includes(value) ? (value as PlacaFormat) : null;
}

/** Milímetros de un lado en píxeles, al dpi de las placas. */
export function pxToMm(px: number): number {
  return (px * 25.4) / PLACA_DPI;
}
