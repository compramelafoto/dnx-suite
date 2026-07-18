import { conversationIdPrefix } from "../conversation/create-conversation-id.js";
import type { AssistantResponse } from "../models/assistant.js";
import type { QuoteRequiredField } from "../quote-request/models.js";
import { logInfo } from "./logger.js";
import { maskSender } from "./mask.js";

function extractedRequiredFields(
  draft: NonNullable<AssistantResponse["quoteRequest"]>["draft"],
): QuoteRequiredField[] {
  const fields: QuoteRequiredField[] = [];
  if (draft.serviceType && draft.serviceType !== "UNKNOWN") fields.push("SERVICE_TYPE");
  if (draft.eventDate) fields.push("EVENT_DATE");
  if (draft.city) fields.push("CITY");
  if (draft.durationHours !== undefined) fields.push("DURATION_HOURS");
  return fields;
}

export function logAssistantProcessing(params: {
  response: AssistantResponse;
  statusCode: number;
  durationMs: number;
  previousStatus?: string;
}): void {
  const { response, statusCode, durationMs, previousStatus } = params;
  const quote = response.quoteRequest;
  const mem = response.memory;

  logInfo("message_processed", {
    conversationIdPrefix: conversationIdPrefix(mem.conversationId),
    isNewConversation: mem.isNewConversation,
    previousStatus: previousStatus ?? null,
    conversationStatus: mem.status,
    activeFlow: mem.activeFlow ?? null,
    intent: response.intent,
    status: response.status,
    requiresHuman: response.requiresHuman,
    quoteStatus: quote?.status ?? "NOT_APPLICABLE",
    extractedFields: quote ? extractedRequiredFields(quote.draft) : [],
    accumulatedFields: quote ? extractedRequiredFields(quote.draft) : [],
    missingFields: quote?.missingFields ?? [],
    warningsCount: quote?.warnings.length ?? 0,
    messageLength: response.context.normalizedText.length,
    senderMasked: maskSender(response.context.participantFrom),
    durationMs,
    httpStatus: statusCode,
  });
}
