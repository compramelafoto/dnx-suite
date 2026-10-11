/**
 * Qué filas de caras se pueden borrar de la base después de pedirle a Amazon que borre
 * la cara de su colección.
 *
 * `rekognitionFaceId` es el **único** dato con el que se puede volver a pedir ese
 * borrado. Si la fila se va de la base mientras la cara sigue viva en la colección, esa
 * cara queda ahí para siempre: nadie sabe ya que existe, no hay forma de nombrarla, y
 * Amazon la cobra todos los meses.
 *
 * Por eso una fila sólo se olvida cuando Amazon confirmó el borrado. Las que fallaron se
 * quedan y la próxima corrida de la purga las vuelve a intentar.
 *
 * Esto no era así hasta el 2026-10-09: la purga anotaba el error y borraba la fila igual.
 * Con la cuenta de Amazon suspendida desde el 2026-10-06 se perdieron de vista las caras
 * de 59 fotos purgadas en esos tres días.
 */

export type FaceDeletionOutcome = {
  /** Id de la fila en `FaceDetection`. */
  id: number;
  /** Id de la cara dentro de la colección de Amazon. */
  faceId: string;
  /** Si Amazon confirmó el borrado. */
  deleted: boolean;
};

export function faceRowsSafeToForget(outcomes: FaceDeletionOutcome[]): number[] {
  return outcomes.filter((o) => o.deleted).map((o) => o.id);
}

/**
 * Si quedó alguna cara sin borrar en Amazon.
 *
 * Mientras haya pendientes, la foto **no** puede borrarse de la base: su fila en `Photo`
 * arrastra las de `FaceDetection` en cascada y volveríamos a perder los identificadores.
 */
export function hasPendingFaceDeletions(outcomes: FaceDeletionOutcome[]): boolean {
  return outcomes.some((o) => !o.deleted);
}
