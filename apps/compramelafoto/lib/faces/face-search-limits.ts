/**
 * Cuántas caras pide la búsqueda por selfie a Amazon Rekognition.
 *
 * La colección de caras es UNA sola para todo CLF: Rekognition devuelve las caras más
 * parecidas de todos los álbumes y recién después nos quedamos con las del álbum. Con
 * 20 caras, a una familia le llegaban unas pocas fotos de su hijo (y menos todavía si
 * había chicos parecidos en otros eventos o fotos subidas dos veces). Por eso la
 * búsqueda de una persona pide muchas más caras. El costo de la consulta es el mismo.
 *
 * Con tantos resultados, el umbral sube a 80% para no mostrar chicos parecidos.
 */
export type FaceSearchLimits = { maxFaces: number; faceMatchThreshold: number };

/** Lo de siempre: para usos internos que sólo necesitan las mejores coincidencias. */
export const FACE_SEARCH_DEFAULT: FaceSearchLimits = { maxFaces: 20, faceMatchThreshold: 70 };

/** Selfie de una persona buscando sus fotos en un álbum o evento. */
export const FACE_SEARCH_PERSON_PHOTOS: FaceSearchLimits = { maxFaces: 1000, faceMatchThreshold: 80 };

/** Rekognition acepta entre 1 y 4096 caras y un umbral entre 0 y 100. */
export function normalizeFaceSearchLimits(limits?: Partial<FaceSearchLimits>): FaceSearchLimits {
  const maxFaces = Math.round(Number(limits?.maxFaces ?? FACE_SEARCH_DEFAULT.maxFaces));
  const threshold = Number(limits?.faceMatchThreshold ?? FACE_SEARCH_DEFAULT.faceMatchThreshold);
  return {
    maxFaces: Number.isFinite(maxFaces) ? Math.min(4096, Math.max(1, maxFaces)) : FACE_SEARCH_DEFAULT.maxFaces,
    faceMatchThreshold: Number.isFinite(threshold)
      ? Math.min(100, Math.max(0, threshold))
      : FACE_SEARCH_DEFAULT.faceMatchThreshold,
  };
}
