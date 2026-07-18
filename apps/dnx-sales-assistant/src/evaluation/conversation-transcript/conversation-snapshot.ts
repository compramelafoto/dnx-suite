import type { QuoteRequestDraft } from "../../quote-request/models.js";

/** Snapshot final seguro (sin precios). */
export type ConversationFinalSnapshot = {
  conversationStatus: string;
  quoteStatus?: string;
  draft?: QuoteRequestDraft;
  intent?: string;
  missingFields: string[];
  pricingRuntimeStatus?: string;
  pricingApprovalStatus?: string;
};
