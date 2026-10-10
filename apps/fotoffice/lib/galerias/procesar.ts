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

function derivada(original: Buffer, lado: number, calidad: number): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: calidad })
    .toBuffer();
}

export async function generarVariantes(original: Buffer): Promise<Variantes> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(original).metadata();
  } catch {
    throw new FotoNoProcesable("El archivo no es una imagen válida.", true);
  }
  if (!meta.format || !FORMATOS.has(meta.format)) throw new FotoNoProcesable("El archivo no es un JPG ni un PNG.", true);
  if (!meta.width || !meta.height) throw new FotoNoProcesable("No se pudo leer el tamaño de la imagen.", true);
  const girada = (meta.orientation ?? 1) >= 5;
  try {
    const vista = await derivada(original, LADO_VISTA, CALIDAD_VISTA);
    const mini = await derivada(original, LADO_MINIATURA, CALIDAD_MINIATURA);
    return { vista, mini, width: girada ? meta.height : meta.width, height: girada ? meta.width : meta.height };
  } catch {
    throw new FotoNoProcesable("No se pudo procesar la imagen.", false);
  }
}
