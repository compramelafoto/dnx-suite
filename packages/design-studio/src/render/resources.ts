/**
 * Puerto de recursos. El módulo no sabe de R2 ni del sistema de archivos: el producto le
 * entrega los bytes. Devolver `null` significa "no existe", y eso detiene la emisión.
 */
export type ResourceResolver = {
  read(ref: string): Promise<Uint8Array | null>;
};

/** Reconoce el formato por los bytes, no por la extensión del nombre. */
export function detectImageFormat(bytes: Uint8Array): "png" | "jpg" | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  return null;
}
