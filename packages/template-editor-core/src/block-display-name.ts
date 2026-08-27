import type { TemplateV2Block, TemplateV2BlockType } from "./render-core";

/**
 * Nombre por defecto cuando `name` está vacío (capas, listas, placeholder del inspector).
 */
const DEFAULT_LABEL_BY_TYPE: Record<TemplateV2BlockType, string> = {
  TEXT: "Texto",
  VARIABLE_TEXT: "Variable",
  SHAPE: "Forma",
  IMAGE: "Imagen",
  BACKGROUND: "Fondo",
  PHOTO: "Foto",
};

/** Nombre visible: `name` si viene definido; si no, etiqueta según tipo. */
export function getBlockDisplayName(block: TemplateV2Block): string {
  const n = block.name?.trim();
  if (n) return n;
  return DEFAULT_LABEL_BY_TYPE[block.type] ?? block.type;
}

/** Etiqueta corta del tipo en español (subtítulo en capas, placeholder, chip «Tipo»). */
export function getBlockTypeLabelEs(type: TemplateV2BlockType): string {
  return DEFAULT_LABEL_BY_TYPE[type] ?? type;
}
