import type { ConversationMemoryContext } from "../conversation/memory-models.js";
import type { QuoteRequestPayload } from "../quote-request/models.js";

/** Canal de entrada. Telegram = canal principal operativo; simulate/lab = técnicos. */
export type AssistantChannel = "simulate" | "telegram";

/** Canal preferido de comunicación del dueño (operativo). */
export type OwnerCommunicationChannel = "TELEGRAM" | "REVIEW_LAB";

/**
 * Intención detectada de forma determinística (sin IA).
 * Provisional: se reemplazará/complementará con un modelo más adelante.
 */
export type AssistantIntent =
  | "GREETING"
  | "GENERAL_SERVICE_INQUIRY"
  | "QUOTE_REQUEST"
  | "AFFIRMATIVE"
  | "NEGATIVE"
  | "THANKS"
  | "HUMAN_HANDOFF_REQUEST"
  | "OUT_OF_SCOPE"
  | "UNKNOWN";

/** Estado interno del procesador (sin IA ni reglas comerciales de precio). */
export type AssistantStatus = "ACKNOWLEDGED";

/** Mensaje de entrada normalizado a dominio (independiente del transporte). */
export type IncomingMessage = {
  from: string;
  text: string;
  channel: AssistantChannel;
  receivedAt: string;
};

/** Contexto conversacional generado por el pipeline (sin persistencia). */
export type ConversationContext = {
  conversationId: string;
  channel: AssistantChannel;
  participantFrom: string;
  originalText: string;
  normalizedText: string;
  createdAt: string;
};

/** Entrada del pipeline interno. */
export type AssistantRequest = {
  message: IncomingMessage;
};

/** Salida del pipeline interno (reutilizable en WA/TG/tests). */
export type AssistantResponse = {
  status: AssistantStatus;
  intent: AssistantIntent;
  text: string;
  requiresHuman: boolean;
  /** Contexto interno — no se expone en HTTP del simulador. */
  context: ConversationContext;
  /** Memoria conversacional (sin ID público en HTTP). */
  memory: ConversationMemoryContext;
  quoteRequest?: QuoteRequestPayload;
  /** IDs de copy aplicados en el turn (calibración / lab). */
  appliedCopyIds?: string[];
  /** Tipo de respuesta del renderer Dani, si aplica. */
  responseType?: string;
};
