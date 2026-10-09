import sharp from "sharp";

const LADO_MAYOR = { obra: 2000, portada: 1600 } as const;
export type UsoImagen = keyof typeof LADO_MAYOR;

/**
 * Tope de píxeles que sharp acepta decodificar (50 megapíxeles). Un archivo chico puede declarar
 * dimensiones enormes —una "bomba de descompresión"— y tumbar la función al expandirse en memoria.
 */
export const MAX_PIXELES = 50_000_000;

const DEMASIADO_GRANDE = "La imagen tiene demasiados píxeles (máximo 50 megapíxeles).";

/** Un problema del archivo que mandó la persona (no del servidor): se responde con 400. */
export class ImagenInvalida extends Error {
  constructor(mensaje = "No es una imagen válida.") {
    super(mensaje);
    this.name = "ImagenInvalida";
  }
}

/**
 * Deja la imagen lista para la web: rota según el EXIF, achica sin agrandar y pasa a WebP.
 * Los originales en alta no se guardan acá: se suben recién al poner una obra a la venta.
 */
export async function procesarImagen(bytes: Buffer, uso: UsoImagen) {
  let meta;
  try {
    meta = await sharp(bytes, { limitInputPixels: MAX_PIXELES }).metadata();
  } catch (err) {
    // sharp ya corta acá si la cabecera declara más píxeles que el tope.
    if (err instanceof Error && /pixel limit/i.test(err.message)) throw new ImagenInvalida(DEMASIADO_GRANDE);
    throw new ImagenInvalida();
  }
  if (!meta.width || !meta.height) throw new ImagenInvalida();
  if (meta.width * meta.height > MAX_PIXELES) throw new ImagenInvalida(DEMASIADO_GRANDE);
  const lado = LADO_MAYOR[uso];
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_PIXELES })
      .rotate()
      .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height, contentType: "image/webp" as const };
  } catch {
    // Pasó la lectura de cabecera pero no se pudo decodificar: archivo truncado o corrupto.
    throw new ImagenInvalida();
  }
}
