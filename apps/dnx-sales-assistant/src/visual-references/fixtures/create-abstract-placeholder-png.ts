/**
 * PNG 1×1 mínimo (bloque de color). No parece fotografía.
 * Identificado como «Referencia de prueba».
 */
export function createAbstractPlaceholderPng(): Buffer {
  // PNG IHDR 1x1 RGB + IDAT + IEND (rojo sólido)
  return Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cf0000020175018e1b0000000049454e44ae426082",
    "hex",
  );
}

export const PLACEHOLDER_LABEL = "Referencia de prueba" as const;
