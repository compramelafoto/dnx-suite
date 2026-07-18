import type { QuoteRequiredField } from "../../../quote-request/models.js";
import type { DaniConversationVersion } from "./dani-response-context.js";

export type DaniResponseType =
  | "ACKNOWLEDGEMENT"
  | "FOLLOW_UP_QUESTION"
  | "CLARIFICATION"
  | "CORRECTION_ACKNOWLEDGEMENT"
  | "INTENT_GUIDANCE"
  | "VISUAL_REFERENCE_PENDING"
  | "VISUAL_REFERENCE_EMPTY"
  | "VISUAL_REFERENCE_READY"
  | "READY_INTERNAL"
  | "CANCEL_ACKNOWLEDGEMENT";

export type DaniResponseResult = {
  message: string;
  responseType: DaniResponseType;
  askedField?: QuoteRequiredField;
  confirmationId?: string;
  styleVersion: DaniConversationVersion;
  appliedCopyIds: string[];
  warnings: string[];
};
