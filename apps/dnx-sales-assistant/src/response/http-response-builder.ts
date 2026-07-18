import type { AppConfig } from "../types/config.js";
import type { AssistantResponse } from "../models/assistant.js";
import type { SimulateMessageSuccessResponse } from "../types/simulate.js";

/**
 * Transforma AssistantResponse → cuerpo HTTP del simulador.
 * No expone remitente, mensaje ni conversationId.
 */
export function buildHttpResponseFromAssistant(
  config: Pick<AppConfig, "mode" | "serviceName" | "version">,
  assistantResponse: AssistantResponse,
  timestamp = new Date().toISOString(),
): SimulateMessageSuccessResponse {
  const body: SimulateMessageSuccessResponse = {
    ok: true,
    mode: config.mode,
    service: config.serviceName,
    version: config.version,
    classification: {
      intent: assistantResponse.intent,
    },
    status: assistantResponse.status,
    requiresHuman: assistantResponse.requiresHuman,
    reply: {
      text: assistantResponse.text,
    },
    timestamp,
  };

  const mem = assistantResponse.memory;
  if (
    assistantResponse.quoteRequest ||
    mem.activeFlow === "QUOTE_REQUEST" ||
    mem.status === "REQUIRES_HUMAN" ||
    mem.status === "COMPLETED"
  ) {
    body.conversation = {
      status: mem.status,
      isNew: mem.isNewConversation,
      expiresAt: mem.expiresAt,
    };
    if (mem.activeFlow) {
      body.conversation.activeFlow = mem.activeFlow;
    }
  }

  if (assistantResponse.quoteRequest) {
    body.quoteRequest = {
      status: assistantResponse.quoteRequest.status,
      draft: assistantResponse.quoteRequest.draft,
      missingFields: assistantResponse.quoteRequest.missingFields,
      warnings: assistantResponse.quoteRequest.warnings,
    };
    if (assistantResponse.quoteRequest.nextQuestion !== undefined) {
      body.quoteRequest.nextQuestion = assistantResponse.quoteRequest.nextQuestion;
    }
  }

  return body;
}
