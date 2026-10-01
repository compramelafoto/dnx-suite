/**
 * La anulación de un movimiento. Módulo PURO.
 *
 * No se borra ni se edita: se escribe un asiento igual y de signo contrario que apunta al
 * original. Los dos quedan a la vista. Un libro que se puede reescribir no prueba nada, y
 * eso vale el doble para los movimientos que vinieron de otro módulo: el dato de verdad vive
 * allá, y editarlo acá haría que los dos se contradijeran sin que nadie se entere.
 *
 * El contramovimiento siempre nace como `manual`: lo decidió una persona, ahora, y no el
 * módulo que originó el asiento. Además, copiar `sourceRef` rompería el índice único que
 * hace idempotente al depósito automático.
 *
 * Una pata de un pase (`transferId !== null`) NO se anula por acá. Un pase escribe dos
 * asientos hermanos —un egreso y un ingreso— para que el total del negocio no cambie; anular
 * uno solo deja al contramovimiento sin `transferId` (esta función no tiene forma de saber a
 * qué pase pertenecía), y ese ingreso o egreso suelto hace dos cosas malas a la vez: la
 * cuenta de origen recupera plata que físicamente ya no tiene, y como no lleva `transferId`
 * los reportes de `balance.ts` lo cuentan como ingreso o egreso real del negocio. Es el error
 * más caro que puede tener este módulo (§6.2.1 del diseño). La única forma correcta de
 * deshacer un pase es hacer el pase inverso, que es una operación con nombre propio y deja
 * su propio rastro en `/caja/pases` — no un truco por la puerta de la anulación genérica.
 */

export type ReversibleMovement = {
  id: string;
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  accountId: string;
  categoryId: string | null;
  paymentMethod: string;
  clientId: string | null;
  description: string;
  alreadyReversed: boolean;
  /** No nulo cuando este asiento es una pata de un pase entre cuentas. */
  transferId: string | null;
};

export type ReversalValues = {
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  accountId: string;
  categoryId: string | null;
  paymentMethod: string;
  clientId: string | null;
  description: string;
  reversesMovementId: string;
  reverseReason: string;
  sourceModule: "manual";
  sourceRef: null;
  /**
   * Se arrastra del original a propósito, aunque hoy siempre llega en `null` acá —el chequeo
   * de más abajo corta antes para cualquier asiento con pase—. Si el día de mañana alguien
   * saca esa guarda sin darse cuenta, el contramovimiento sigue conservando el marcado en vez
   * de perderlo en silencio, que es justo el defecto que este archivo existe para no repetir.
   */
  transferId: string | null;
};

export type ReversalResult =
  | { ok: true; values: ReversalValues }
  | { ok: false; error: string };

export function buildReversal(original: ReversibleMovement, reason: string): ReversalResult {
  if (original.alreadyReversed) return { ok: false, error: "Ese movimiento ya está anulado." };

  if (original.transferId !== null) {
    return {
      ok: false,
      error: "Ese movimiento es parte de un pase entre cuentas. Para deshacerlo, hacé el pase inverso.",
    };
  }

  const motivo = reason.trim();
  if (motivo === "") return { ok: false, error: "Escribí por qué se anula el movimiento." };

  return {
    ok: true,
    values: {
      kind: original.kind === "INGRESO" ? "EGRESO" : "INGRESO",
      amountMinor: original.amountMinor,
      accountId: original.accountId,
      categoryId: original.categoryId,
      paymentMethod: original.paymentMethod,
      clientId: original.clientId,
      description: `Anulación de: ${original.description}`,
      reversesMovementId: original.id,
      reverseReason: motivo,
      sourceModule: "manual",
      sourceRef: null,
      transferId: original.transferId,
    },
  };
}
