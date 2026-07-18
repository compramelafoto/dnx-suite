import { classifyIntent } from "../intent/classify-intent.js";
import type {
  AssistantIntent,
  AssistantResponse,
  AssistantStatus,
  ConversationContext,
} from "../models/assistant.js";
import type {
  ConversationMemoryContext,
  ConversationStatus,
  ConversationStyleState,
  StoredConversation,
} from "../conversation/memory-models.js";
import { detectCancelCommand } from "../conversation/detect-cancel.js";
import {
  composeClientSalesReply,
  createDefaultRoleState,
  detectRoleSignal,
  resolveConversationRole,
  sanitizeClientFacingText,
  textEnterClientRole,
  textExitToOwnerRole,
  transitionConversationRole,
  type ConversationRoleState,
} from "../conversation/role/index.js";
import {
  composeConversationReply,
  type ComposeConversationReplyResult,
} from "../conversation/style/compose-conversation-reply.js";
import type { ConversationStyleEngine } from "../conversation/style/conversation-style-engine.js";

function styleMeta(reply: ComposeConversationReplyResult): {
  appliedCopyIds?: string[];
  responseType?: string;
} {
  return {
    appliedCopyIds: reply.daniResult?.appliedCopyIds,
    responseType: reply.daniResult?.responseType,
  };
}
import { extractQuoteRequest } from "../quote-request/extract-quote-request.js";
import { getMissingQuoteFields } from "../quote-request/get-missing-fields.js";
import { mergeQuoteRequestDraft } from "../quote-request/merge-quote-draft.js";
import type {
  QuoteRequestDraft,
  QuoteRequestPayload,
  QuoteRequiredField,
} from "../quote-request/models.js";

export const CANCEL_QUOTE_REPLY =
  "Entendido. Cancelé la solicitud de presupuesto en curso.";

export type MessageProcessorResult = Omit<AssistantResponse, "context"> & {
  /** Conversación a persistir tras el turn (undefined = eliminar del store). */
  nextStored: StoredConversation | undefined;
  memory: ConversationMemoryContext;
};

export type ProcessMessageClock = {
  now: () => Date;
  nextExpiresAt: (from?: Date) => string;
};

export type ProcessMessageOptions = {
  styleEngine?: ConversationStyleEngine;
};

const WEAK_INTENTS_FOR_QUOTE_CONTINUATION: ReadonlySet<AssistantIntent> = new Set([
  "UNKNOWN",
  "AFFIRMATIVE",
  "GENERAL_SERVICE_INQUIRY",
  "NEGATIVE",
  "THANKS",
  "GREETING",
]);

function buildQuotePayload(
  draft: QuoteRequestDraft,
  warnings: string[],
  nextQuestion?: string,
): QuoteRequestPayload {
  const missingFields = getMissingQuoteFields(draft);
  const status =
    missingFields.length === 0 ? "READY_FOR_CALCULATION" : "COLLECTING_INFORMATION";
  const payload: QuoteRequestPayload = {
    status,
    draft,
    missingFields,
    warnings,
  };
  if (status === "COLLECTING_INFORMATION" && nextQuestion) {
    payload.nextQuestion = nextQuestion;
  }
  return payload;
}

function emptyMemory(
  conversationId: string,
  expiresAt: string,
  roleState?: ConversationRoleState,
): ConversationMemoryContext {
  return {
    conversationId,
    isNewConversation: true,
    status: "ACTIVE",
    expiresAt,
    roleState,
  };
}

function bumpStyleTurn(
  previous: ConversationStyleState | undefined,
  assistantText: string,
  commercialProbe?: string,
): ConversationStyleState {
  const asked = [...(previous?.previouslyAskedCommercial ?? [])];
  if (commercialProbe && !asked.includes(commercialProbe)) {
    asked.push(commercialProbe);
  }
  return {
    turnNumber: (previous?.turnNumber ?? 0) + 1,
    previousAssistantMessages: [
      ...(previous?.previousAssistantMessages ?? []),
      assistantText,
    ].slice(-8),
    previouslyAskedFields: previous?.previouslyAskedFields ?? [],
    lastConfirmationId: previous?.lastConfirmationId,
    usedCopyIds: previous?.usedCopyIds ?? [],
    shownVisualReferenceIds: previous?.shownVisualReferenceIds,
    previouslyAskedCommercial: asked,
  };
}

function knownFields(draft?: QuoteRequestDraft): Set<QuoteRequiredField> {
  const set = new Set<QuoteRequiredField>();
  if (!draft) return set;
  if (draft.serviceType && draft.serviceType !== "UNKNOWN") set.add("SERVICE_TYPE");
  if (draft.eventDate) set.add("EVENT_DATE");
  if (draft.city) set.add("CITY");
  if (draft.durationHours !== undefined) set.add("DURATION_HOURS");
  return set;
}

function fieldsLearnedThisTurn(
  previous: QuoteRequestDraft | undefined,
  next: QuoteRequestDraft,
  extracted: QuoteRequiredField[],
): QuoteRequiredField[] {
  const before = knownFields(previous);
  const learned = new Set<QuoteRequiredField>();
  for (const f of extracted) learned.add(f);
  for (const f of knownFields(next)) {
    if (!before.has(f)) learned.add(f);
  }
  // Corrección de valor ya conocido
  if (
    previous?.durationHours !== undefined &&
    next.durationHours !== undefined &&
    previous.durationHours !== next.durationHours
  ) {
    learned.add("DURATION_HOURS");
  }
  if (previous?.city && next.city && previous.city !== next.city) {
    learned.add("CITY");
  }
  if (
    previous?.serviceType &&
    next.serviceType &&
    previous.serviceType !== next.serviceType
  ) {
    learned.add("SERVICE_TYPE");
  }
  if (
    previous?.eventDate &&
    next.eventDate &&
    previous.eventDate !== next.eventDate
  ) {
    learned.add("EVENT_DATE");
  }
  return [...learned];
}

/**
 * Procesador con estado conversacional ya resuelto (no consulta el store).
 */
export function processMessage(
  context: ConversationContext,
  previous: StoredConversation | undefined,
  clock: ProcessMessageClock,
  options: ProcessMessageOptions = {},
): MessageProcessorResult {
  const now = clock.now();
  const nowIso = now.toISOString();
  const expiresAt = clock.nextExpiresAt(now);
  const classified = classifyIntent(context.normalizedText).intent;
  const cancel = detectCancelCommand(context.normalizedText);
  const statusAck: AssistantStatus = "ACKNOWLEDGED";
  const styleEngine = options.styleEngine;
  const currentRole = resolveConversationRole(previous?.roleState);
  let roleState: ConversationRoleState =
    previous?.roleState ?? createDefaultRoleState(nowIso);

  // --- Cambio de rol por lenguaje natural (antes de quote/cancel) ---
  const roleSignal = detectRoleSignal(context.normalizedText, currentRole);
  if (roleSignal.action === "ENTER" && roleSignal.role === "CLIENT") {
    roleState = transitionConversationRole({
      current: roleState,
      nextRole: "CLIENT",
      at: nowIso,
      enteredBy: "NATURAL_LANGUAGE",
    });
    const text = textEnterClientRole();
    const memory: ConversationMemoryContext = {
      conversationId: context.conversationId,
      isNewConversation: !previous,
      status: previous?.status ?? "ACTIVE",
      activeFlow: previous?.activeFlow,
      expiresAt,
      previousDraft: previous?.quoteRequestDraft,
      roleState,
    };
    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: previous?.status ?? "ACTIVE",
      activeFlow: previous?.activeFlow,
      quoteRequestDraft: previous?.quoteRequestDraft
        ? { ...previous.quoteRequestDraft }
        : undefined,
      pricingResult: previous?.pricingResult,
      pricingCacheKey: previous?.pricingCacheKey,
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
      expiresAt,
      styleState: bumpStyleTurn(previous?.styleState, text),
      roleState,
    };
    return {
      status: statusAck,
      intent: classified,
      text,
      requiresHuman: false,
      memory,
      nextStored,
      ...(previous?.quoteRequestDraft
        ? { quoteRequest: buildQuotePayload(previous.quoteRequestDraft, []) }
        : {}),
    };
  }

  if (roleSignal.action === "EXIT" && roleSignal.role === "OWNER") {
    if (currentRole === "OWNER") {
      const text = "Ya estás en modo propietario.";
      const memory: ConversationMemoryContext = {
        conversationId: context.conversationId,
        isNewConversation: !previous,
        status: previous?.status ?? "ACTIVE",
        activeFlow: previous?.activeFlow,
        expiresAt,
        previousDraft: previous?.quoteRequestDraft,
        roleState,
      };
      const nextStored: StoredConversation = previous
        ? {
            ...previous,
            updatedAt: nowIso,
            expiresAt,
            roleState,
            styleState: bumpStyleTurn(previous.styleState, text),
          }
        : {
            id: context.conversationId,
            status: "ACTIVE",
            createdAt: nowIso,
            updatedAt: nowIso,
            expiresAt,
            roleState,
            styleState: bumpStyleTurn(undefined, text),
          };
      return {
        status: statusAck,
        intent: classified,
        text,
        requiresHuman: false,
        memory,
        nextStored,
      };
    }
    roleState = transitionConversationRole({
      current: roleState,
      nextRole: "OWNER",
      at: nowIso,
      enteredBy: "NATURAL_LANGUAGE",
    });
    const text = textExitToOwnerRole();
    const memory: ConversationMemoryContext = {
      conversationId: context.conversationId,
      isNewConversation: false,
      status: previous?.status ?? "ACTIVE",
      activeFlow: previous?.activeFlow,
      expiresAt,
      previousDraft: previous?.quoteRequestDraft,
      roleState,
    };
    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: previous?.status ?? "ACTIVE",
      activeFlow: previous?.activeFlow,
      quoteRequestDraft: previous?.quoteRequestDraft
        ? { ...previous.quoteRequestDraft }
        : undefined,
      pricingResult: previous?.pricingResult,
      pricingCacheKey: previous?.pricingCacheKey,
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
      expiresAt,
      styleState: bumpStyleTurn(previous?.styleState, text),
      roleState,
    };
    return {
      status: statusAck,
      intent: classified,
      text,
      requiresHuman: false,
      memory,
      nextStored,
      ...(previous?.quoteRequestDraft
        ? { quoteRequest: buildQuotePayload(previous.quoteRequestDraft, []) }
        : {}),
    };
  }

  const baseMemory = previous
    ? {
        conversationId: previous.id,
        isNewConversation: false,
        status: previous.status,
        activeFlow: previous.activeFlow,
        expiresAt,
        previousDraft: previous.quoteRequestDraft,
        roleState,
      }
    : emptyMemory(context.conversationId, expiresAt, roleState);

  // --- Cancelación explícita ---
  if (
    cancel === "CANCEL_ACTIVE_FLOW" &&
    previous?.activeFlow === "QUOTE_REQUEST" &&
    previous.status !== "COMPLETED"
  ) {
    const ownerRole = transitionConversationRole({
      current: roleState,
      nextRole: "OWNER",
      at: nowIso,
      enteredBy: "CONVERSATION_END",
    });
    const reply = composeConversationReply({
      userMessage: context.normalizedText,
      intent: classified,
      conversationStatus: "COMPLETED",
      conversationId: context.conversationId,
      missingFields: [],
      fieldsLearnedThisTurn: [],
      cancelActive: true,
      styleState: previous.styleState,
      styleEngine,
    });
    const memory: ConversationMemoryContext = {
      ...baseMemory,
      status: "COMPLETED",
      activeFlow: undefined,
      expiresAt,
      roleState: ownerRole,
    };
    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: "COMPLETED",
      createdAt: previous.createdAt,
      updatedAt: nowIso,
      expiresAt,
      styleState: reply.nextStyleState,
      roleState: ownerRole,
    };
    return {
      status: statusAck,
      intent: classified,
      text: reply.text,
      requiresHuman: false,
      memory,
      nextStored,
      ...styleMeta(reply),
    };
  }

  // --- Handoff interrumpe flujo activo de presupuesto ---
  if (classified === "HUMAN_HANDOFF_REQUEST") {
    const reply = composeConversationReply({
      userMessage: context.normalizedText,
      intent: "HUMAN_HANDOFF_REQUEST",
      conversationStatus: "REQUIRES_HUMAN",
      conversationId: context.conversationId,
      draft: previous?.quoteRequestDraft,
      previousDraft: previous?.quoteRequestDraft,
      missingFields: previous?.quoteRequestDraft
        ? getMissingQuoteFields(previous.quoteRequestDraft)
        : [],
      fieldsLearnedThisTurn: [],
      styleState: previous?.styleState,
      styleEngine,
    });
    const memory: ConversationMemoryContext = {
      ...baseMemory,
      isNewConversation: !previous,
      status: "REQUIRES_HUMAN",
      activeFlow: previous?.activeFlow,
      expiresAt,
      previousDraft: previous?.quoteRequestDraft,
      roleState,
    };
    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: "REQUIRES_HUMAN",
      activeFlow: previous?.activeFlow,
      quoteRequestDraft: previous?.quoteRequestDraft
        ? { ...previous.quoteRequestDraft }
        : undefined,
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
      expiresAt,
      styleState: reply.nextStyleState,
      roleState,
    };
    return {
      status: statusAck,
      intent: "HUMAN_HANDOFF_REQUEST",
      text: reply.text,
      requiresHuman: true,
      memory,
      nextStored,
      ...styleMeta(reply),
      ...(previous?.quoteRequestDraft
        ? {
            quoteRequest: buildQuotePayload(previous.quoteRequestDraft, []),
          }
        : {}),
    };
  }

  const activeQuote =
    previous?.status === "ACTIVE" && previous.activeFlow === "QUOTE_REQUEST";
  const isClient = resolveConversationRole(roleState) === "CLIENT";

  // --- Modo CLIENT: siempre venta comercial (sin precios / sin estilo OWNER) ---
  if (isClient) {
    const extraction = extractQuoteRequest(context.normalizedText);
    const merged = mergeQuoteRequestDraft(
      previous?.quoteRequestDraft,
      extraction.draft,
    );
    const warnings = [...extraction.warnings, ...merged.warnings];
    const clientReply = composeClientSalesReply({
      userMessage: context.normalizedText,
      draft: merged.draft,
      previouslyAskedCommercial: previous?.styleState?.previouslyAskedCommercial,
    });
    const text = sanitizeClientFacingText(clientReply.text);
    const quoteRequest = buildQuotePayload(
      merged.draft,
      warnings,
      clientReply.nextQuestion,
    );
    const styleState = bumpStyleTurn(
      previous?.styleState,
      text,
      clientReply.askedCommercialProbe,
    );
    const memory: ConversationMemoryContext = {
      conversationId: context.conversationId,
      isNewConversation: !previous,
      status: "ACTIVE",
      activeFlow: "QUOTE_REQUEST",
      expiresAt,
      previousDraft: previous?.quoteRequestDraft,
      roleState,
    };
    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: "ACTIVE",
      activeFlow: "QUOTE_REQUEST",
      quoteRequestDraft: { ...merged.draft },
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
      expiresAt,
      styleState,
      roleState,
      pricingResult: previous?.pricingResult,
      pricingCacheKey: previous?.pricingCacheKey,
    };
    return {
      status: statusAck,
      intent:
        classified === "QUOTE_REQUEST" || extraction.extractedFields.length > 0
          ? "QUOTE_REQUEST"
          : classified,
      text,
      requiresHuman: false,
      quoteRequest,
      memory,
      nextStored,
    };
  }

  // --- Continuación de presupuesto (intenciones débiles o QUOTE_REQUEST) ---
  if (
    activeQuote &&
    (classified === "QUOTE_REQUEST" || WEAK_INTENTS_FOR_QUOTE_CONTINUATION.has(classified))
  ) {
    const extraction = extractQuoteRequest(context.normalizedText);
    const merged = mergeQuoteRequestDraft(previous.quoteRequestDraft, extraction.draft);
    const warnings = [...extraction.warnings, ...merged.warnings];
    const missingFields = getMissingQuoteFields(merged.draft);
    const quoteStatus =
      missingFields.length === 0 ? "READY_FOR_CALCULATION" : "COLLECTING_INFORMATION";
    const learned = fieldsLearnedThisTurn(
      previous.quoteRequestDraft,
      merged.draft,
      extraction.extractedFields,
    );
    const completed = quoteStatus === "READY_FOR_CALCULATION";
    const convStatus: ConversationStatus = completed ? "COMPLETED" : "ACTIVE";

    const reply = composeConversationReply({
      userMessage: context.normalizedText,
      intent: "QUOTE_REQUEST",
      conversationStatus: convStatus,
      conversationId: context.conversationId,
      draft: merged.draft,
      previousDraft: previous.quoteRequestDraft,
      missingFields,
      fieldsLearnedThisTurn: learned,
      quoteStatus,
      styleState: previous.styleState,
      styleEngine,
    });

    const quoteRequest = buildQuotePayload(merged.draft, warnings, reply.nextQuestion);

    const memory: ConversationMemoryContext = {
      conversationId: context.conversationId,
      isNewConversation: false,
      status: convStatus,
      activeFlow: completed ? undefined : "QUOTE_REQUEST",
      expiresAt,
      previousDraft: previous.quoteRequestDraft,
      roleState,
    };

    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: convStatus,
      activeFlow: completed ? undefined : "QUOTE_REQUEST",
      quoteRequestDraft: { ...merged.draft },
      createdAt: previous.createdAt,
      updatedAt: nowIso,
      expiresAt,
      styleState: reply.nextStyleState,
      roleState,
    };

    return {
      status: statusAck,
      intent: "QUOTE_REQUEST",
      text: reply.text,
      requiresHuman: false,
      quoteRequest,
      memory,
      nextStored,
      ...styleMeta(reply),
    };
  }

  // --- Nueva solicitud de presupuesto (sin flujo activo, o tras COMPLETED) ---
  if (classified === "QUOTE_REQUEST") {
    const extraction = extractQuoteRequest(context.normalizedText);
    const merged = mergeQuoteRequestDraft(undefined, extraction.draft);
    const warnings = [...extraction.warnings, ...merged.warnings];
    const missingFields = getMissingQuoteFields(merged.draft);
    const quoteStatus =
      missingFields.length === 0 ? "READY_FOR_CALCULATION" : "COLLECTING_INFORMATION";
    const learned = fieldsLearnedThisTurn(
      undefined,
      merged.draft,
      extraction.extractedFields,
    );
    const completed = quoteStatus === "READY_FOR_CALCULATION";
    const convStatus: ConversationStatus = completed ? "COMPLETED" : "ACTIVE";

    const reply = composeConversationReply({
      userMessage: context.normalizedText,
      intent: "QUOTE_REQUEST",
      conversationStatus: convStatus,
      conversationId: context.conversationId,
      draft: merged.draft,
      missingFields,
      fieldsLearnedThisTurn: learned,
      quoteStatus,
      styleState: previous?.status === "COMPLETED" ? undefined : previous?.styleState,
      styleEngine,
    });

    const quoteRequest = buildQuotePayload(merged.draft, warnings, reply.nextQuestion);

    const memory: ConversationMemoryContext = {
      conversationId: context.conversationId,
      isNewConversation: !previous || previous.status === "COMPLETED",
      status: convStatus,
      activeFlow: completed ? undefined : "QUOTE_REQUEST",
      expiresAt,
      roleState,
    };

    const nextStored: StoredConversation = {
      id: context.conversationId,
      status: convStatus,
      activeFlow: completed ? undefined : "QUOTE_REQUEST",
      quoteRequestDraft: { ...merged.draft },
      createdAt: previous?.status === "COMPLETED" ? nowIso : (previous?.createdAt ?? nowIso),
      updatedAt: nowIso,
      expiresAt,
      styleState: reply.nextStyleState,
      roleState,
    };

    return {
      status: statusAck,
      intent: "QUOTE_REQUEST",
      text: reply.text,
      requiresHuman: false,
      quoteRequest,
      memory,
      nextStored,
      ...styleMeta(reply),
    };
  }

  const reply = composeConversationReply({
    userMessage: context.normalizedText,
    intent: classified,
    conversationStatus: previous?.status ?? "ACTIVE",
    conversationId: context.conversationId,
    draft: previous?.quoteRequestDraft,
    previousDraft: previous?.quoteRequestDraft,
    missingFields: previous?.quoteRequestDraft
      ? getMissingQuoteFields(previous.quoteRequestDraft)
      : [],
    fieldsLearnedThisTurn: [],
    styleState: previous?.styleState,
    styleEngine,
  });

  const memory: ConversationMemoryContext = {
    conversationId: context.conversationId,
    isNewConversation: !previous,
    status: previous?.status ?? "ACTIVE",
    activeFlow: previous?.activeFlow,
    expiresAt,
    previousDraft: previous?.quoteRequestDraft,
    roleState,
  };

  let nextStored: StoredConversation | undefined;
  if (previous) {
    nextStored = {
      ...previous,
      updatedAt: nowIso,
      expiresAt,
      quoteRequestDraft: previous.quoteRequestDraft
        ? { ...previous.quoteRequestDraft }
        : undefined,
      styleState: reply.nextStyleState,
      roleState,
    };
  } else {
    nextStored = {
      id: context.conversationId,
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt,
      styleState: reply.nextStyleState,
      roleState,
    };
  }

  return {
    status: statusAck,
    intent: classified,
    text: reply.text,
    requiresHuman: false,
    memory,
    nextStored,
    ...styleMeta(reply),
  };
}
