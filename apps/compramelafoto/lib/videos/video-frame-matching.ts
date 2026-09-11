/**
 * Piezas puras del reconocimiento facial en video.
 *
 * Los fotogramas se indexan en la MISMA colección de Rekognition que las fotos.
 * Eso es seguro porque `searchFacesByImage` devuelve sólo el id de cara, y cada
 * consumidor lo resuelve contra su propia tabla: las fotos contra
 * `FaceDetection`, los videos contra `VideoFrameFace`. Un id que no está en la
 * tabla que se consulta se ignora solo.
 *
 * La consecuencia buena: una sola selfie y una sola llamada a Amazon alcanzan
 * para encontrar fotos y videos a la vez. El costo no sube.
 */

/** Prefijo del identificador que se le manda a Amazon por cada fotograma. */
export const VIDEO_FRAME_EXTERNAL_PREFIX = "vf_";

/**
 * Identificador del fotograma para Amazon.
 *
 * Rekognition sólo acepta letras, números y `_ . - :` en este campo, así que el
 * prefijo va con guión bajo.
 */
export function frameExternalImageId(videoFrameId: number): string {
  return `${VIDEO_FRAME_EXTERNAL_PREFIX}${videoFrameId}`;
}

/** Vuelve del identificador de Amazon al fotograma. `null` si no es de video. */
export function parseFrameExternalImageId(externalImageId: string | null | undefined): number | null {
  if (!externalImageId?.startsWith(VIDEO_FRAME_EXTERNAL_PREFIX)) return null;
  const raw = externalImageId.slice(VIDEO_FRAME_EXTERNAL_PREFIX.length);
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export type FrameFaceHit = {
  videoId: number;
  timeSeconds: number;
  similarity: number;
};

export type VideoMatch = {
  videoId: number;
  /** Segundo del fotograma donde mejor se reconoció a la persona. */
  timeSeconds: number;
  similarity: number;
  /** Cuántos fotogramas distintos del video dieron coincidencia. */
  frameHits: number;
};

/**
 * Resume las coincidencias por video: se queda con el mejor fotograma de cada uno.
 *
 * Una persona que camina frente a la cámara aparece en varios fotogramas, pero
 * al cliente le sirve un solo momento: el que mejor se la ve. Los demás sólo
 * cuentan como señal de confianza (`frameHits`).
 */
export function summarizeVideoMatches(hits: FrameFaceHit[]): VideoMatch[] {
  const porVideo = new Map<number, VideoMatch>();

  for (const hit of hits) {
    const actual = porVideo.get(hit.videoId);
    if (!actual) {
      porVideo.set(hit.videoId, {
        videoId: hit.videoId,
        timeSeconds: hit.timeSeconds,
        similarity: hit.similarity,
        frameHits: 1,
      });
      continue;
    }

    actual.frameHits += 1;
    if (hit.similarity > actual.similarity) {
      actual.similarity = hit.similarity;
      actual.timeSeconds = hit.timeSeconds;
    }
  }

  // Más parecido primero; si empatan, el que apareció en más fotogramas.
  return [...porVideo.values()].sort(
    (a, b) => b.similarity - a.similarity || b.frameHits - a.frameHits
  );
}

/** "4:32" para mostrarle al cliente dónde aparece. */
export function formatVideoTimestamp(timeSeconds: number): string {
  const total = Math.max(0, Math.floor(timeSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type VideoSelfieHit = VideoMatch & {
  title: string | null;
  categoryLabel: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  /** "4:32", listo para mostrar. */
  timestampLabel: string;
};
