/**
 * De las coincidencias de Rekognition (ya pasadas a fotos del álbum), qué fotos sumar al pedido:
 * una por foto (con el mayor parecido) y nunca una que el pedido ya tiene.
 */
export function pickPhotosToAdd(
  matches: ReadonlyArray<{ photoId: number; similarity: number | null }>,
  alreadyInOrder: ReadonlySet<number>
): Array<{ photoId: number; similarity: number | null }> {
  const best = new Map<number, number | null>();
  for (const m of matches) {
    if (!Number.isInteger(m.photoId) || m.photoId <= 0) continue;
    if (alreadyInOrder.has(m.photoId)) continue;
    const prev = best.get(m.photoId);
    if (prev === undefined || (m.similarity ?? 0) > (prev ?? 0)) {
      best.set(m.photoId, m.similarity);
    }
  }
  return [...best.entries()]
    .map(([photoId, similarity]) => ({ photoId, similarity }))
    .sort((a, b) => a.photoId - b.photoId);
}

/**
 * ¿Hay que volver a buscar fotos de esta cara? Sólo con el álbum terminado de analizar
 * y si llegaron fotos desde la última búsqueda (o si nunca se buscó).
 */
export function shouldSyncGrowingFace(params: {
  albumReady: boolean;
  lastPhotoAt: Date | null;
  lastSyncedAt: Date | null;
}): boolean {
  if (!params.albumReady) return false;
  if (!params.lastSyncedAt) return true;
  if (!params.lastPhotoAt) return false;
  return params.lastPhotoAt.getTime() > params.lastSyncedAt.getTime();
}
