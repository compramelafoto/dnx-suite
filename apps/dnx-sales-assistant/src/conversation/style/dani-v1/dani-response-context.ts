import type { AssistantIntent } from "../../../models/assistant.js";
import type { ConversationStatus } from "../../memory-models.js";
import type {
  QuoteRequestDraft,
  QuoteRequiredField,
} from "../../../quote-request/models.js";

export const DANI_CONVERSATION_VERSION = "dani-conversation-v1" as const;
export type DaniConversationVersion = typeof DANI_CONVERSATION_VERSION;

export type DaniVisualReferenceHint = {
  requested: boolean;
  niche?: string;
  /** Cantidad de referencias autorizadas seleccionadas para el turno. */
  selectedCount?: number;
  /** Propósito educativo principal de la primera referencia (para copy). */
  primaryEducationalPurpose?: string;
  selectedIds?: string[];
};

/** Contexto interno para construir respuestas Estilo Dani (no se expone en HTTP). */
export type DaniResponseContext = {
  userMessage: string;
  detectedIntent: AssistantIntent;
  conversationStatus: ConversationStatus;
  draft?: QuoteRequestDraft;
  knownFields: QuoteRequiredField[];
  fieldsLearnedThisTurn: QuoteRequiredField[];
  missingFields: QuoteRequiredField[];
  previouslyAskedFields: QuoteRequiredField[];
  correctedFields: QuoteRequiredField[];
  turnNumber: number;
  previousAssistantMessages: string[];
  lastConfirmationId?: string;
  usedCopyIds: string[];
  conversationId: string;
  quoteStatus?: string;
  visualReferenceIntent?: DaniVisualReferenceHint;
  cancelActive?: boolean;
};
