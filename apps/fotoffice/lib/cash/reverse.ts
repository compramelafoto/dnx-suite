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
};

export type ReversalResult =
  | { ok: true; values: ReversalValues }
  | { ok: false; error: string };

export function buildReversal(original: ReversibleMovement, reason: string): ReversalResult {
  if (original.alreadyReversed) return { ok: false, error: "Ese movimiento ya está anulado." };

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
    },
  };
}
