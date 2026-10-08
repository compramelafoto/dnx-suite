/**
 * Las piezas que FotoRank diseña con el diseñador compartido (Template V2): el diploma y las
 * imágenes de ganadores. Qué tamaño tiene cada una y con qué marca se reconoce su plantilla.
 *
 * Módulo puro: lo importan pantallas de cliente, así que no puede arrastrar la base.
 */

/** Resolución con la que se diseña y se dibuja. Con el mismo dpi en el lienzo y en el PNG, 1080 px son 1080 px. */
export const DESIGN_DPI = 300;

/** El diploma: A4 apaisado (297 × 210 mm) a 300 dpi. */
export const DIPLOMA_CANVAS_PX = { width: 3508, height: 2480 } as const;

export const WINNER_FORMATS = ["cuadrada", "historia"] as const;
export type WinnerFormat = (typeof WINNER_FORMATS)[number];

export const WINNER_FORMAT_LABEL: Record<WinnerFormat, string> = {
  cuadrada: "Cuadrada (publicación 1080 × 1080)",
  historia: "Historia (vertical 1080 × 1920)",
};

/** Los píxeles finales de cada formato: los que pide Instagram. */
export const WINNER_FORMAT_PX: Record<WinnerFormat, { width: number; height: number }> = {
  cuadrada: { width: 1080, height: 1080 },
  historia: { width: 1080, height: 1920 },
};

/**
 * Marca de la plantilla, guardada en `metaJson.templateKey` de su versión.
 *
 * Un diploma puede tener varias plantillas por concurso (la fila `FotorankDiplomaTemplate`
 * apunta a la suya por id), así que su marca sólo dice qué es. Las imágenes de ganador son una
 * por formato y por concurso: se buscan por marca + concurso.
 */
export const DIPLOMA_TEMPLATE_KEY = "fotorank-diploma";

export function winnerTemplateKey(format: WinnerFormat): string {
  return `fotorank-ganador-${format}`;
}

export function parseWinnerFormat(value: unknown): WinnerFormat | null {
  return (WINNER_FORMATS as readonly unknown[]).includes(value) ? (value as WinnerFormat) : null;
}

/** Píxeles del lienzo a milímetros del documento, al dpi de diseño. */
export function pxToMm(px: number): number {
  return (px * 25.4) / DESIGN_DPI;
}

/**
 * Lo que guarda `FotorankDiplomaTemplate.layoutJson` desde que los diplomas se diseñan en el
 * diseñador compartido: sólo a qué plantilla apunta.
 */
export type DiplomaDesignLink = { engine: "designer"; designTemplateId: string };

export function readDiplomaDesignLink(layoutJson: unknown): DiplomaDesignLink | null {
  if (!layoutJson || typeof layoutJson !== "object" || Array.isArray(layoutJson)) return null;
  const v = layoutJson as { engine?: unknown; designTemplateId?: unknown };
  if (v.engine !== "designer") return null;
  if (typeof v.designTemplateId !== "string" || v.designTemplateId.length === 0) return null;
  return { engine: "designer", designTemplateId: v.designTemplateId };
}

/** Dónde vive el editor dentro de FotoRank. Igual a `TEMPLATE_V2_BASE_PATHS.fotorank`. */
export const DESIGNER_BASE_PATH = "/dashboard/disenador";

export function designerEditorPath(templateId: string, versionId: string): string {
  return `${DESIGNER_BASE_PATH}/${encodeURIComponent(templateId)}/${encodeURIComponent(versionId)}`;
}
