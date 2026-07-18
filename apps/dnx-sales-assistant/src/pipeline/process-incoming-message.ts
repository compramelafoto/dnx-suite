import { createConversationContext } from "../conversation/create-context.js";
import { createConversationId } from "../conversation/create-conversation-id.js";
import type { ConversationStore } from "../conversation/conversation-store.js";
import type { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import { normalizeMessageText } from "../conversation/normalize-text.js";
import type { AssistantRequest, AssistantResponse } from "../models/assistant.js";
import { processMessage } from "../processor/message-processor.js";
import { CONVERSATION_TTL_MS } from "../conversation/memory-config.js";
import type { ConversationStyleEngine } from "../conversation/style/conversation-style-engine.js";
import {
  applyPricingRuntime,
  type PricingRuntimeDeps,
} from "../pricing/runtime/pricing-runtime.js";

export class PipelineValidationError extends Error {
  readonly code = "message_required" as const;

  constructor(message = "El mensaje es obligatorio") {
    super(message);
    this.name = "PipelineValidationError";
  }
}

export type PipelineDeps = {
  store: ConversationStore;
  /** Reloj / TTL del store en memoria (tests e InMemoryConversationStore). */
  memoryClock?: Pick<InMemoryConversationStore, "now" | "nextExpiresAt">;
  /** Runtime silencioso de pricing (opcional; default desde disco). */
  pricingRuntime?: PricingRuntimeDeps;
  /** Motor de estilo conversacional (default: dani-conversation-v1). */
  styleEngine?: ConversationStyleEngine;
};

/**
 * Pipeline interno con memoria conversacional inyectada.
 * Persistencia y procesamiento ocurren en un único `store.update` (mutex por conversación).
 * Tras READY_FOR_CALCULATION ejecuta pricing runtime en memoria (sin cambiar la respuesta).
 */
export async function processIncomingMessage(
  request: AssistantRequest,
  deps: PipelineDeps,
): Promise<AssistantResponse> {
  const rawText = request.message.text;
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new PipelineValidationError();
  }

  const normalizedText = normalizeMessageText(rawText);
  if (normalizedText.length === 0) {
    throw new PipelineValidationError();
  }

  const conversationId = createConversationId(request.message.from);
  const context = createConversationContext(
    request.message,
    normalizedText,
    conversationId,
  );

  const clock = {
    now: () => deps.memoryClock?.now() ?? new Date(),
    nextExpiresAt: (from?: Date) =>
      deps.memoryClock?.nextExpiresAt(from) ??
      new Date((from ?? new Date()).getTime() + CONVERSATION_TTL_MS).toISOString(),
  };

  let response!: AssistantResponse;

  await deps.store.update(conversationId, async (previous) => {
    const result = processMessage(context, previous, clock, {
      styleEngine: deps.styleEngine,
    });
    const { nextStored, memory, ...rest } = result;

    response = {
      ...rest,
      context,
      memory,
    };

    if (!nextStored) {
      return undefined;
    }

    const pricing = await applyPricingRuntime(
      {
        quoteStatus: result.quoteRequest?.status,
        draft: nextStored.quoteRequestDraft ?? result.quoteRequest?.draft,
        previousDraft: previous?.quoteRequestDraft,
        previousResult: previous?.pricingResult,
        previousCacheKey: previous?.pricingCacheKey,
      },
      deps.pricingRuntime ?? {},
    );

    return {
      ...nextStored,
      pricingResult: pricing.pricingResult,
      pricingCacheKey: pricing.pricingCacheKey,
    };
  });

  return response;
}
