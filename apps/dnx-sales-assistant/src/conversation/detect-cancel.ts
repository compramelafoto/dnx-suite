import { foldTextForIntent } from "../intent/fold-text.js";
import type { ConversationCommand } from "./memory-models.js";

/**
 * Cancelación explícita del flujo de presupuesto.
 * No interpreta "no" / "no gracias" como cancelación total.
 */
export function detectCancelCommand(normalizedText: string): ConversationCommand | undefined {
  const folded = foldTextForIntent(normalizedText);
  if (
    /\bcancelar\s+presupuesto\b/.test(folded) ||
    /\bdejemos\s+el\s+presupuesto\b/.test(folded) ||
    /\bno\s+quiero\s+continuar\b/.test(folded) ||
    /\bolvidalo\b/.test(folded) ||
    /^cancelar([!?.\s]*)$/.test(folded)
  ) {
    return "CANCEL_ACTIVE_FLOW";
  }
  return undefined;
}
