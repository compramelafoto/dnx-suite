/**
 * Procesado de la imagen de un concurso: recorte a 16:9, redimensionado y
 * compresión.
 *
 * Criterio de calidad: no se agranda nunca. Si alguien sube una imagen de
 * 1400 px de ancho para un banner de 1920, se guarda a 1400 — estirarla no
 * agrega detalle, sólo peso y blandura. Y no se recomprime más de lo necesario:
 * la escala de calidad está alta a propósito.
 */

import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  contestMediaSpec,
  isSixteenByNine,
  type ContestMediaKind,
  type ContestMediaMime,
} from "./specs";

export type ProcessedContestMedia = {
  bytes: Uint8Array;
  mimeType: ContestMediaMime;
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
  sha256: string;
  /** Dimensiones del archivo tal como llegó, para el registro. */
  sourceWidth: number;
  sourceHeight: number;
  /** true si hubo que recortar para llegar a 16:9. */
  cropped: boolean;
};

export type ContestMediaSourceInfo = {
  width: number;
  height: number;
  format: string | undefined;
  hasAlpha: boolean;
};

/**
 * Lee las dimensiones sin decodificar la imagen entera.
 *
 * Va antes de cualquier procesado: si el archivo está corrupto o es una bomba
 * de descompresión, esto falla barato en vez de comerse la memoria del proceso.
 */
export async function readSourceInfo(bytes: Uint8Array): Promise<ContestMediaSourceInfo | null> {
  try {
    const meta = await sharp(Buffer.from(bytes), { failOn: "error" }).metadata();
    if (!meta.width || !meta.height) return null;
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      hasAlpha: Boolean(meta.hasAlpha),
    };
  } catch {
    return null;
  }
}

/**
 * Traduce el punto focal (0-100) a la posición de recorte que entiende sharp.
 *
 * Reutiliza la misma convención que `contest-visual/focal.ts` usa para
 * `object-position` en el navegador, así que lo que se recorta acá coincide con
 * lo que la landing venía encuadrando.
 */
function focalToSharpPosition(focalX: number, focalY: number): string {
  const x = Math.min(100, Math.max(0, focalX));
  const y = Math.min(100, Math.max(0, focalY));

  const horizontal = x <= 33 ? "left" : x >= 67 ? "right" : "";
  const vertical = y <= 33 ? "top" : y >= 67 ? "bottom" : "";

  if (vertical && horizontal) return `${vertical} ${horizontal}`;
  if (vertical) return vertical;
  if (horizontal) return horizontal;
  return "centre";
}

/**
 * Genera el derivado de un tipo de imagen.
 *
 * El formato de salida sigue al de entrada salvo por una excepción: un PNG sin
 * transparencia se guarda como JPG. Una fotografía en PNG puede pesar diez veces
 * más que el mismo JPG sin que se note la diferencia, y un flyer exportado en
 * PNG es un caso habitual.
 */
export async function processContestMedia(input: {
  bytes: Uint8Array;
  kind: ContestMediaKind;
  focalPointX?: number;
  focalPointY?: number;
  sourceInfo: ContestMediaSourceInfo;
}): Promise<ProcessedContestMedia> {
  const spec = contestMediaSpec(input.kind);
  const { sourceInfo } = input;

  /**
   * Nunca escalar hacia arriba: el destino se acota al tamaño real de origen,
   * conservando 16:9.
   */
  const maxWidthFromSource = isSixteenByNine(sourceInfo.width, sourceInfo.height)
    ? sourceInfo.width
    : Math.min(sourceInfo.width, Math.round((sourceInfo.height * 16) / 9));

  const targetWidth = Math.min(spec.width, Math.max(1, maxWidthFromSource));
  const targetHeight = Math.round((targetWidth * 9) / 16);

  const position = focalToSharpPosition(input.focalPointX ?? 50, input.focalPointY ?? 50);

  const pipeline = sharp(Buffer.from(input.bytes), { failOn: "error" })
    /**
     * `rotate()` sin argumentos aplica la orientación EXIF y la descarta. Sin
     * esto una foto tomada en horizontal con el teléfono girado sale acostada.
     */
    .rotate()
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "cover",
      position,
      withoutEnlargement: true,
    });

  const keepAlpha = sourceInfo.hasAlpha && sourceInfo.format === "png";

  let out: Buffer;
  let mimeType: ContestMediaMime;
  let extension: "jpg" | "png" | "webp";

  if (sourceInfo.format === "webp") {
    out = await pipeline.webp({ quality: spec.quality, effort: 4 }).toBuffer();
    mimeType = "image/webp";
    extension = "webp";
  } else if (keepAlpha) {
    out = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
    mimeType = "image/png";
    extension = "png";
  } else {
    out = await pipeline
      .jpeg({ quality: spec.quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    mimeType = "image/jpeg";
    extension = "jpg";
  }

  const finalMeta = await sharp(out).metadata();

  return {
    bytes: new Uint8Array(out),
    mimeType,
    extension,
    width: finalMeta.width ?? targetWidth,
    height: finalMeta.height ?? targetHeight,
    sha256: createHash("sha256").update(out).digest("hex"),
    sourceWidth: sourceInfo.width,
    sourceHeight: sourceInfo.height,
    cropped: !isSixteenByNine(sourceInfo.width, sourceInfo.height),
  };
}

/**
 * Miniatura para la vista previa del administrador.
 * Se genera en memoria y viaja como data URI: no toca el storage, porque
 * todavía no hay nada guardado que previsualizar.
 */
export async function buildPreviewDataUri(input: {
  bytes: Uint8Array;
  focalPointX?: number;
  focalPointY?: number;
}): Promise<string> {
  const out = await sharp(Buffer.from(input.bytes), { failOn: "error" })
    .rotate()
    .resize({
      width: 640,
      height: 360,
      fit: "cover",
      position: focalToSharpPosition(input.focalPointX ?? 50, input.focalPointY ?? 50),
      withoutEnlargement: false,
    })
    .jpeg({ quality: 72 })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}
