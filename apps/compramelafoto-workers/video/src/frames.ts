import { execa } from "execa";
import path from "node:path";
import sharp from "sharp";

/**
 * Extracción de fotogramas para reconocimiento facial en video.
 *
 * Los fotogramas salen del archivo ORIGINAL, nunca de la preview: la marca de
 * agua quemada y la compresión de la preview le arruinan la detección de caras
 * a Rekognition. El worker ya tiene el original descargado cuando corre esto,
 * así que no cuesta una segunda descarga.
 *
 * Cada fotograma guarda el segundo exacto del que salió. Eso es lo que después
 * permite decirle al cliente "apareces en el minuto 4:32" y llevarlo a ese
 * punto del reproductor, en vez de sólo "apareces en este video".
 */

/** Se saltea el 5% inicial y final: ahí suele haber títulos, negro o fundidos. */
export const FRAME_EDGE_MARGIN_RATIO = 0.05;

/** Lado largo del fotograma. Rekognition no gana nada con más resolución. */
export const FRAME_MAX_SIDE = 1280;

export type FramePlanInput = {
  durationSeconds: number;
  count: number;
};

/**
 * Elige en qué segundos tomar los fotogramas, repartidos a lo largo del video.
 *
 * Reparto uniforme y no aleatorio: en una ceremonia o un acto escolar la gente
 * se mueve por el cuadro, así que cubrir el video entero encuentra más caras
 * distintas que concentrarse en un tramo.
 */
export function planFrameTimes({ durationSeconds, count }: FramePlanInput): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  if (!Number.isFinite(count) || count <= 0) return [];

  const margen = durationSeconds * FRAME_EDGE_MARGIN_RATIO;
  const desde = margen;
  const hasta = durationSeconds - margen;
  const util = hasta - desde;

  if (util <= 0) {
    // Video tan corto que el margen se come todo: un solo fotograma al medio.
    const medio = redondear(durationSeconds / 2);
    return medio > 0 && medio < durationSeconds ? [medio] : [];
  }

  const tiempos = new Set<number>();
  // count + 1 divisiones para que ningún fotograma caiga exactamente en el borde.
  const paso = util / (count + 1);

  for (let i = 1; i <= count; i += 1) {
    const t = redondear(desde + paso * i);
    if (t > 0 && t < durationSeconds) tiempos.add(t);
  }

  return [...tiempos].sort((a, b) => a - b);
}

/** Centésimas: el mismo redondeo que guarda la base, para que las claves coincidan. */
function redondear(segundos: number): number {
  return Math.round(segundos * 100) / 100;
}

/** Ruta del fotograma en R2. El milisegundo lo hace único dentro del video. */
export function frameKey(albumId: number, videoId: number, timeSeconds: number): string {
  const ms = Math.round(timeSeconds * 1000);
  return `albums/${albumId}/videos/frames/${videoId}/${ms}.jpg`;
}

export type ExtractedFrame = {
  timeSeconds: number;
  localPath: string;
  width: number;
  height: number;
};

/**
 * Saca un fotograma en el segundo pedido y lo deja como JPEG.
 *
 * `-ss` va ANTES de `-i` a propósito: así ffmpeg salta directo al punto en vez
 * de decodificar el video desde el principio. Con 20 fotogramas la diferencia
 * es de minutos.
 */
export async function extractFrame(
  inputPath: string,
  workDir: string,
  timeSeconds: number
): Promise<ExtractedFrame | null> {
  const salida = path.join(workDir, `frame-${Math.round(timeSeconds * 1000)}.jpg`);

  try {
    await execa("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(timeSeconds),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      `scale='min(${FRAME_MAX_SIDE},iw)':-2`,
      "-q:v",
      "2",
      "-y",
      salida,
    ]);
  } catch (err: unknown) {
    console.warn("[video-worker] fotograma falló", {
      timeSeconds,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Rekognition sólo acepta JPEG o PNG de verdad: se normaliza y se confirma
  // que el archivo tiene contenido antes de darlo por bueno.
  try {
    const meta = await sharp(salida).metadata();
    if (!meta.width || !meta.height) return null;
    return { timeSeconds, localPath: salida, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}
