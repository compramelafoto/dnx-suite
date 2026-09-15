/**
 * Qué videos puede ver quien verificó su identidad con una selfie.
 *
 * En un álbum con contenido oculto, pasar la selfie no abre todo: abre lo
 * propio. Para las fotos eso ya funcionaba así, y esto lo lleva a los videos
 * con el mismo criterio:
 *
 * - Los videos donde la persona fue reconocida.
 * - Los videos ya analizados **sin ninguna cara** (la cancha, un paisaje, un
 *   detalle): no exponen a nadie.
 *
 * Lo que NO se muestra, y es el punto de todo esto:
 *
 * - Los videos donde aparecen otras personas.
 * - Los videos que **todavía no se analizaron**. Podrían tener a cualquiera, y
 *   mostrarlos por no haber terminado de procesarlos sería filtrar material
 *   ajeno.
 */

export type VideoFacesSummary = {
  videoId: number;
  /** El análisis facial ya terminó en al menos un fotograma. */
  hasAnalyzedFrames: boolean;
  /** Caras encontradas en el video, como las identifica Rekognition. */
  faceIds: string[];
};

export type AllowedVideosResult = {
  allowedVideoIds: number[];
  /** Videos donde la persona fue reconocida. */
  matchedCount: number;
  /** Videos sin ninguna cara, visibles para cualquiera que pase la selfie. */
  noFaceCount: number;
  /** Videos que todavía no se analizaron y por eso quedan ocultos. */
  pendingCount: number;
};

export function resolveAllowedVideoIds(
  videos: VideoFacesSummary[],
  selfieFaceIds: string[]
): AllowedVideosResult {
  const buscadas = new Set(selfieFaceIds);

  const permitidos = new Set<number>();
  let matchedCount = 0;
  let noFaceCount = 0;
  let pendingCount = 0;

  for (const video of videos) {
    if (!video.hasAnalyzedFrames) {
      pendingCount += 1;
      continue;
    }

    if (video.faceIds.length === 0) {
      noFaceCount += 1;
      permitidos.add(video.videoId);
      continue;
    }

    if (video.faceIds.some((f) => buscadas.has(f))) {
      matchedCount += 1;
      permitidos.add(video.videoId);
    }
  }

  return {
    allowedVideoIds: [...permitidos],
    matchedCount,
    noFaceCount,
    pendingCount,
  };
}
