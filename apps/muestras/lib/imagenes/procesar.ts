import sharp from "sharp";

const LADO_MAYOR = { obra: 2000, portada: 1600 } as const;
export type UsoImagen = keyof typeof LADO_MAYOR;

/**
 * Deja la imagen lista para la web: rota según el EXIF, achica sin agrandar y pasa a WebP.
 * Los originales en alta no se guardan acá: se suben recién al poner una obra a la venta.
 */
export async function procesarImagen(bytes: Buffer, uso: UsoImagen) {
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new Error("No es una imagen válida.");
  }
  if (!meta.width || !meta.height) throw new Error("No es una imagen válida.");
  const lado = LADO_MAYOR[uso];
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, contentType: "image/webp" as const };
}
