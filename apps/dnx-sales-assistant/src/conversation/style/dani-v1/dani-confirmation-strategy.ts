import { confirmationCopies, type DaniCopyEntry } from "./dani-copy-catalog.js";
import { pickDeterministicCopy } from "./dani-pick-copy.js";
import type { DaniResponseContext } from "./dani-response-context.js";

/**
 * Confirmación opcional: no en todos los turnos; no repetir la misma ID consecutiva.
 */
export function selectConfirmation(
  ctx: DaniResponseContext,
): DaniCopyEntry | undefined {
  // Primer turno de quote o sin aprendizaje → a menudo sin confirmación
  if (ctx.fieldsLearnedThisTurn.length === 0 && ctx.correctedFields.length === 0) {
    return undefined;
  }
  // Ready / solo corrección: el copy de corrección ya actúa como ack
  if (ctx.correctedFields.length > 0) {
    return undefined;
  }
  // No confirmar si no aprendimos nada nuevo relevante
  if (ctx.fieldsLearnedThisTurn.length === 0) {
    return undefined;
  }
  // Evitar confirmación en cada turno: solo si hay aprendizaje y no es el primer mensaje vacío
  if (ctx.turnNumber > 1 && ctx.fieldsLearnedThisTurn.length === 1 && ctx.missingFields.length > 2) {
    // Turnos tempranos con poco progreso: a veces omitir
    if (ctx.turnNumber % 2 === 0) return undefined;
  }

  const pool = confirmationCopies().filter((c) => c.id !== ctx.lastConfirmationId);
  if (pool.length === 0) return undefined;
  return pickDeterministicCopy(
    pool,
    `${ctx.conversationId}:conf:${ctx.turnNumber}`,
    ctx.usedCopyIds,
  );
}
