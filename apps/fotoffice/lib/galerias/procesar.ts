import sharp from "sharp";
import { CALIDAD_MINIATURA, CALIDAD_VISTA, LADO_MINIATURA, LADO_VISTA } from "./constantes";

/**
 * Genera la vista (2048 px) y la miniatura (480 px) de una foto. PURO: recibe y devuelve Buffers.
 * - `rotate()` sin argumentos aplica la orientación EXIF y la quita; las derivadas salen derechas.
 * - Sin agrandar: una foto chica queda de su tamaño.
 * - Sin metadatos: sharp no los copia salvo que se lo pidamos, así que EXIF (GPS incluido), XMP e
 *   IPTC no llegan a lo que ve el cliente.
 * Procesar de a una foto por llamada y no cachear: la memoria de la función es limitada.
 */
sharp.cache(false);
sharp.concurrency(1);

const FORMATOS = new Set(["jpeg", "png"]);

export class FotoNoProcesable extends Error {
  /** Si reintentar no sirve (no es una imagen JPG/PNG), el error es definitivo. */
  constructor(message: string, readonly definitivo: boolean) {
    super(message);
  }
}

export type Variantes = {
  vista: Buffer;
  mini: Buffer;
  /** Ancho y alto del original ya derecho (con la orientación aplicada). */
  width: number;
  height: number;
};

/** 100 megapíxeles: cubre cámaras de 61 Mpx con margen y frena las "bombas" de descompresión. */
export const MAX_PIXELES_ORIGINAL = 100_000_000;
export const MOTIVO_DEMASIADO_GRANDE = "La foto es demasiado grande (más de 100 megapíxeles).";

const esLimitePixeles = (e: unknown) => e instanceof Error && /pixel limit/i.test(e.message);

/**
 * Decodifica el original UNA sola vez: la vista (2048) sale del original y la miniatura (480) de
 * la vista ya derecha y sin transparencia. Los PNG con transparencia se aplanan sobre blanco.
 */
export async function generarVariantes(original: Buffer, opciones: { maxPixeles?: number } = {}): Promise<Variantes> {
  const maxPixeles = opciones.maxPixeles ?? MAX_PIXELES_ORIGINAL;
  const img = sharp(original, { limitInputPixels: maxPixeles });
  let meta: sharp.Metadata;
  try {
    meta = await img.metadata();
  } catch (e) {
    if (esLimitePixeles(e)) throw new FotoNoProcesable(MOTIVO_DEMASIADO_GRANDE, true);
    throw new FotoNoProcesable("El archivo no es una imagen válida.", true);
  }
  if (!meta.format || !FORMATOS.has(meta.format)) throw new FotoNoProcesable("El archivo no es un JPG ni un PNG.", true);
  if (!meta.width || !meta.height) throw new FotoNoProcesable("No se pudo leer el tamaño de la imagen.", true);
  if (meta.width * meta.height > maxPixeles) throw new FotoNoProcesable(MOTIVO_DEMASIADO_GRANDE, true);
  const girada = (meta.orientation ?? 1) >= 5;
  try {
    const vista = await img
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: LADO_VISTA, height: LADO_VISTA, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CALIDAD_VISTA })
      .toBuffer();
    const mini = await sharp(vista)
      .resize({ width: LADO_MINIATURA, height: LADO_MINIATURA, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CALIDAD_MINIATURA })
      .toBuffer();
    return { vista, mini, width: girada ? meta.height : meta.width, height: girada ? meta.width : meta.height };
  } catch (e) {
    if (esLimitePixeles(e)) throw new FotoNoProcesable(MOTIVO_DEMASIADO_GRANDE, true);
    throw new FotoNoProcesable("No se pudo procesar la imagen.", false);
  }
}
