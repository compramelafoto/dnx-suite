import type {
  QuoteRequestDraft,
  QuoteRequiredField,
} from "../quote-request/models.js";
import type { ConversationPricingResult } from "../pricing/runtime/pricing-runtime-result.js";
import type { ConversationRoleState } from "./role/conversation-role.js";

export type ConversationStatus = "ACTIVE" | "COMPLETED" | "REQUIRES_HUMAN";

export type ActiveConversationFlow = "QUOTE_REQUEST";

/** Estado interno del motor de estilo (no se expone en HTTP). */
export type ConversationStyleState = {
  turnNumber: number;
  previousAssistantMessages: string[];
  previouslyAskedFields: QuoteRequiredField[];
  lastConfirmationId?: string;
  usedCopyIds: string[];
  /** IDs de referencias visuales ya mostradas (evitar repetición inmediata). */
  shownVisualReferenceIds?: string[];
  /** Sondas comerciales ya hechas en modo CLIENT. */
  previouslyAskedCommercial?: string[];
};

export type StoredConversation = {
  id: string;
  status: ConversationStatus;
  activeFlow?: ActiveConversationFlow;
  quoteRequestDraft?: QuoteRequestDraft;
  /** Resultado interno de pricing — no se expone en HTTP. */
  pricingResult?: ConversationPricingResult;
  /** Huella de cache del último cálculo. */
  pricingCacheKey?: string;
  /** Estado del renderer conversacional (Dani / legacy). */
  styleState?: ConversationStyleState;
  /**
   * Rol conversacional (OWNER / CLIENT).
   * Independiente de auth Telegram y de pricing.
   */
  roleState?: ConversationRoleState;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

/** Contexto de memoria resuelto para el processor (sin consultar el store). */
export type ConversationMemoryContext = {
  conversationId: string;
  isNewConversation: boolean;
  status: ConversationStatus;
  activeFlow?: ActiveConversationFlow;
  expiresAt: string;
  previousDraft?: QuoteRequestDraft;
  roleState?: ConversationRoleState;
};

export type ConversationCommand = "CANCEL_ACTIVE_FLOW";
