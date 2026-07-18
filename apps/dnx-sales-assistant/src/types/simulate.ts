import type { AssistantIntent, AssistantStatus } from "../models/assistant.js";
import type {
  ActiveConversationFlow,
  ConversationStatus,
} from "../conversation/memory-models.js";
import type {
  QuoteRequestDraft,
  QuoteRequestStatus,
  QuoteRequiredField,
} from "../quote-request/models.js";

/** Contrato estable de entrada — POST /simulate/message */
export type SimulateMessageRequest = {
  from: string;
  message: string;
};

export type SimulateQuoteRequestResponse = {
  status: QuoteRequestStatus;
  draft: QuoteRequestDraft;
  missingFields: QuoteRequiredField[];
  nextQuestion?: string;
  warnings: string[];
};

export type SimulateConversationResponse = {
  status: ConversationStatus;
  activeFlow?: ActiveConversationFlow;
  isNew: boolean;
  expiresAt: string;
};

/** Contrato de éxito — POST /simulate/message (sin remitente ni mensaje). */
export type SimulateMessageSuccessResponse = {
  ok: true;
  mode: "simulate";
  service: "dnx-sales-assistant";
  version: string;
  classification: {
    intent: AssistantIntent;
  };
  status: AssistantStatus;
  requiresHuman: boolean;
  conversation?: SimulateConversationResponse;
  quoteRequest?: SimulateQuoteRequestResponse;
  reply: {
    text: string;
  };
  timestamp: string;
};

export type SimulateMessageErrorCode =
  | "invalid_json"
  | "validation_error"
  | "payload_too_large"
  | "empty_body"
  | "unsupported_media_type";

/** Contrato estable de error — POST /simulate/message */
export type SimulateMessageErrorResponse = {
  ok: false;
  error: SimulateMessageErrorCode;
  service: "dnx-sales-assistant";
  details?: unknown;
};

export type SimulateValidationIssue = {
  path: string;
  message: string;
};
