import type { QuoteRequiredField } from "../../quote-request/models.js";

/** Traza segura de un turno — sin montos ni breakdown. */
export type ConversationTurnTrace = {
  turnNumber: number;
  userMessage: string;
  assistantMessage: string;
  detectedIntent?: string;
  extractedFields: QuoteRequiredField[];
  missingFields: QuoteRequiredField[];
  conversationStatus: string;
  quoteStatus?: string;
  pricingRuntimeStatus?: string;
  warnings: string[];
  visualReferenceRequested?: boolean;
  visualNiche?: string;
};
