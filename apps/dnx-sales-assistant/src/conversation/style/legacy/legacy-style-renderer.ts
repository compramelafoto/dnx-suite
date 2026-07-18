import type { AssistantIntent } from "../../../models/assistant.js";
import type { QuoteRequiredField } from "../../../quote-request/models.js";
import {
  QUOTE_READY_MESSAGE,
  selectNextQuoteQuestion,
} from "../../../quote-request/select-next-question.js";
import { REPLY_TEXT_BY_INTENT } from "../../../response/intent-replies.js";

/** Misma frase que el processor (evitar import circular). */
export const LEGACY_CANCEL_QUOTE_REPLY =
  "Entendido. Cancelé la solicitud de presupuesto en curso.";

export type LegacyRenderInput = {
  intent: AssistantIntent;
  missingFields: QuoteRequiredField[];
  quoteStatus?: string;
  cancelActive?: boolean;
};

/**
 * Renderer legacy — conserva el comportamiento previo a dani-conversation-v1.
 */
export function renderLegacyResponse(input: LegacyRenderInput): string {
  if (input.cancelActive) {
    return LEGACY_CANCEL_QUOTE_REPLY;
  }
  if (input.quoteStatus === "READY_FOR_CALCULATION") {
    return QUOTE_READY_MESSAGE;
  }
  if (
    input.quoteStatus === "COLLECTING_INFORMATION" ||
    input.intent === "QUOTE_REQUEST"
  ) {
    if (input.missingFields.length > 0) {
      return selectNextQuoteQuestion(input.missingFields);
    }
    return QUOTE_READY_MESSAGE;
  }
  return REPLY_TEXT_BY_INTENT[input.intent];
}
