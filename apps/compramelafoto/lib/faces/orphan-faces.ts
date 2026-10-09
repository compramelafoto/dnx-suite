/**
 * Caras que quedaron en la colección de Amazon sin dueño en la base.
 *
 * Pasa cuando una foto se purga y el borrado remoto falla: hasta el 2026-10-09 la purga
 * anotaba el error y borraba la fila igual, y con ella el `rekognitionFaceId`. Sin ese
 * dato la cara es inalcanzable desde la aplicación, pero Amazon la sigue cobrando todos
 * los meses. La única forma de encontrarlas es listar la colección entera y restar las
 * que la base todavía reconoce.
 *
 * El arreglo de la purga evita que se sigan generando; esto limpia las que ya están.
 */

/** Las que están en Amazon y la base ya no reconoce. */
export function orphanFaceIds(
  idsInCollection: readonly string[],
  idsInDb: ReadonlySet<string>
): string[] {
  return idsInCollection.filter((id) => !idsInDb.has(id));
}

export class OrphanScanRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrphanScanRefusal";
  }
}

/** Debajo de esta proporción, lo que leímos de la base no es creíble. */
const PROPORCION_MINIMA_CREIBLE = 0.1;

/**
 * Se planta antes de borrar nada si lo que devolvió la base no tiene sentido.
 *
 * Si la consulta falla, se corta a la mitad o apunta a una base equivocada, **todas** las
 * caras de la colección parecerían huérfanas y el barrido la vaciaría entera. Eso no se
 * deshace: habría que reindexar 182.765 fotos, unos USD 183 y varios días, y mientras
 * tanto ningún cliente se encuentra por selfie.
 *
 * Más vale no limpiar nada que limpiar de más.
 */
export function guardOrphanScan(conteos: {
  facesInDb: number;
  facesInCollection: number;
}): void {
  const { facesInDb, facesInCollection } = conteos;

  // Colección vacía: no hay nada que borrar, y nada que validar.
  if (facesInCollection === 0) return;

  if (facesInDb === 0) {
    throw new OrphanScanRefusal(
      `La base no devolvió ninguna cara y la colección tiene ${facesInCollection}. ` +
        "Parece una consulta fallida, no una colección huérfana. No se borra nada."
    );
  }

  const proporcion = facesInDb / facesInCollection;
  if (proporcion < PROPORCION_MINIMA_CREIBLE) {
    throw new OrphanScanRefusal(
      `La base devolvió ${facesInDb} caras contra ${facesInCollection} en la colección ` +
        `(${(proporcion * 100).toFixed(1)}%). Es sospechosamente poco. No se borra nada.`
    );
  }
}
