import {
  QUOTE_REQUIRED_FIELDS_ORDER,
  type QuoteRequiredField,
} from "../../../quote-request/models.js";
import {
  getCopyById,
  questionCopiesForField,
  type DaniCopyEntry,
} from "./dani-copy-catalog.js";
import { pickDeterministicCopy } from "./dani-pick-copy.js";
import type { DaniResponseContext } from "./dani-response-context.js";

/**
 * Siguiente campo faltante según orden estable del contrato real.
 * No pregunta campos ya conocidos.
 */
export function selectNextMissingField(
  missingFields: readonly QuoteRequiredField[],
): QuoteRequiredField | undefined {
  for (const field of QUOTE_REQUIRED_FIELDS_ORDER) {
    if (missingFields.includes(field)) return field;
  }
  return missingFields[0];
}

export function selectQuestionCopy(
  ctx: DaniResponseContext,
  field: QuoteRequiredField,
): DaniCopyEntry {
  const candidates = questionCopiesForField(field);
  const recentTexts = new Set(
    ctx.previousAssistantMessages.map((m) => m.trim().toLowerCase()),
  );
  const unusedText = candidates.filter(
    (c) => !recentTexts.has(c.text.trim().toLowerCase()),
  );
  const pool = unusedText.length > 0 ? unusedText : candidates;
  return pickDeterministicCopy(
    pool,
    `${ctx.conversationId}:${field}:${ctx.turnNumber}`,
    ctx.usedCopyIds,
  );
}

export function resolveCopyOrFallback(id: string, fallbackText: string): DaniCopyEntry {
  return (
    getCopyById(id) ?? {
      id: "FALLBACK_INLINE",
      kind: "CLARIFICATION",
      text: fallbackText,
    }
  );
}
