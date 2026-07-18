import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";

export type HumanReviewVerdict = "APPROVED" | "NEEDS_ADJUSTMENT" | "INCORRECT";

export type HumanVisualReferenceVerdict =
  | "USEFUL"
  | "WRONG_NICHE"
  | "LOW_QUALITY"
  | "WOULD_NOT_USE"
  | "REVIEW_RIGHTS";

export type HumanResponseReview = {
  conversationId: string;
  turnNumber: number;
  verdict: HumanReviewVerdict;
  note?: string;
  assistantMessage: string;
  styleVersion: string;
  askedField?: string;
  createdAt: string;
};

export type HumanVisualReferenceReview = {
  sessionId: string;
  referenceId: string;
  niche: string;
  verdict: HumanVisualReferenceVerdict;
  note?: string;
  createdAt: string;
};

export type LabPublicVisualReference = {
  id: string;
  title: string;
  description: string;
  niches: string[];
  orientation: string;
  educationalPurpose: string[];
  tags: string[];
  authorName?: string;
  attributionRequired: boolean;
  attributionText?: string;
  authorizationBasis: string;
  status: string;
  assetUrl: string;
};

export type LabStyleFlag = {
  code: string;
  severity: string;
  explanation: string;
};

export type LabTurnDiagnostics = {
  intent?: string;
  conversationStatus: string;
  quoteStatus?: string;
  knownFields: QuoteRequiredField[];
  fieldsLearnedThisTurn: QuoteRequiredField[];
  correctedFields: QuoteRequiredField[];
  missingFields: QuoteRequiredField[];
  askedField?: string;
  responseType?: string;
  styleVersion?: string;
  styleEngine: ConversationStyleEngine;
  daniScore: number;
  flags: LabStyleFlag[];
  pricingRuntimeStatus: "READY" | "INCOMPLETE" | "FAILED" | "NOT_RUN";
  visualReferenceRequested: boolean;
  visualNiche?: string;
  visualConfidence?: number;
  visualProvider?: "LOCAL_CURATED";
  visualAuthorizedCount?: number;
  visualReferences?: LabPublicVisualReference[];
  appliedCopyIds?: string[];
};

export type LabTurn = {
  turnNumber: number;
  userMessage: string;
  assistantMessage: string;
  diagnostics: LabTurnDiagnostics;
  humanReview?: HumanResponseReview;
};

export type LabSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
  /** Teléfono sintético → conversationId del store real. */
  participantFrom: string;
  styleEngine: ConversationStyleEngine;
  turns: LabTurn[];
  humanReviews: HumanResponseReview[];
  humanVisualReviews: HumanVisualReferenceReview[];
  scenarioId?: string;
  scenarioCursor?: number;
};
