/**
 * «Buscar al alumno» del canje en modo fotógrafo: el fotógrafo toca una foto (y una cara) del
 * chico y Rekognition devuelve las caras parecidas de toda la colección. Esto las convierte en
 * fotos del álbum, con la foto tocada primero y las demás de mayor a menor parecido.
 */
export function fotosDelAlumno(
  origen: { photoId: number },
  matches: Array<{ faceId: string; similarity: number }>,
  detecciones: Array<{ rekognitionFaceId: string; photoId: number }>,
  fotosDelAlbum: Set<number>,
): number[] {
  const fotoDeCara = new Map(detecciones.map((d) => [d.rekognitionFaceId, d.photoId] as const));
  const mejor = new Map<number, number>();
  for (const m of matches) {
    const photoId = fotoDeCara.get(m.faceId);
    if (photoId == null || !fotosDelAlbum.has(photoId) || photoId === origen.photoId) continue;
    mejor.set(photoId, Math.max(mejor.get(photoId) ?? -Infinity, m.similarity));
  }
  const resto = [...mejor.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return [origen.photoId, ...resto];
}
