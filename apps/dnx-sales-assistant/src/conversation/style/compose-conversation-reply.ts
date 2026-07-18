import { logWarn } from "../../logger/logger.js";
import type { AssistantIntent } from "../../models/assistant.js";
import type {
  QuoteRequestDraft,
  QuoteRequiredField,
} from "../../quote-request/models.js";
import type { ConversationStatus } from "../memory-models.js";
import type { ConversationStyleState } from "../memory-models.js";
import { detectVisualReferenceIntent } from "../../evaluation/visual-reference/detect-visual-reference-intent.js";
import { isVisualReferenceNiche } from "../../visual-references/domain/visual-reference-niche.js";
import { LocalCuratedVisualReferenceProvider } from "../../visual-references/provider/local-curated-visual-reference-provider.js";
import { selectVisualReferences } from "../../visual-references/selection/select-visual-references.js";
import {
  DEFAULT_CONVERSATION_STYLE_ENGINE,
  type ConversationStyleEngine,
} from "./conversation-style-engine.js";
import { DANI_CONVERSATION_VERSION } from "./dani-v1/dani-response-context.js";
import type { DaniResponseContext } from "./dani-v1/dani-response-context.js";
import type { DaniResponseResult } from "./dani-v1/dani-response-result.js";
import { renderDaniResponse } from "./dani-v1/dani-style-renderer.js";
import { hasCriticalStyleViolation } from "./dani-v1/dani-style-guards.js";
import { renderLegacyResponse } from "./legacy/legacy-style-renderer.js";

export type ComposeConversationReplyInput = {
  userMessage: string;
  intent: AssistantIntent;
  conversationStatus: ConversationStatus;
  conversationId: string;
  draft?: QuoteRequestDraft;
  previousDraft?: QuoteRequestDraft;
  missingFields: QuoteRequiredField[];
  fieldsLearnedThisTurn: QuoteRequiredField[];
  quoteStatus?: string;
  cancelActive?: boolean;
  styleState?: ConversationStyleState;
  styleEngine?: ConversationStyleEngine;
};

export type ComposeConversationReplyResult = {
  text: string;
  nextQuestion?: string;
  styleEngineUsed: ConversationStyleEngine;
  daniResult?: DaniResponseResult;
  fellBackToLegacy: boolean;
  nextStyleState: ConversationStyleState;
};

function knownFieldsFromDraft(draft?: QuoteRequestDraft): QuoteRequiredField[] {
  const fields: QuoteRequiredField[] = [];
  if (!draft) return fields;
  if (draft.serviceType && draft.serviceType !== "UNKNOWN") fields.push("SERVICE_TYPE");
  if (draft.eventDate) fields.push("EVENT_DATE");
  if (draft.city) fields.push("CITY");
  if (draft.durationHours !== undefined) fields.push("DURATION_HOURS");
  return fields;
}

function detectCorrectedFields(
  previous: QuoteRequestDraft | undefined,
  next: QuoteRequestDraft | undefined,
  learned: QuoteRequiredField[],
): QuoteRequiredField[] {
  if (!previous || !next) return [];
  const corrected: QuoteRequiredField[] = [];
  for (const field of learned) {
    if (field === "SERVICE_TYPE" && previous.serviceType && next.serviceType && previous.serviceType !== next.serviceType) {
      corrected.push(field);
    }
    if (field === "EVENT_DATE" && previous.eventDate && next.eventDate && previous.eventDate !== next.eventDate) {
      corrected.push(field);
    }
    if (field === "CITY" && previous.city && next.city && previous.city !== next.city) {
      corrected.push(field);
    }
    if (
      field === "DURATION_HOURS" &&
      previous.durationHours !== undefined &&
      next.durationHours !== undefined &&
      previous.durationHours !== next.durationHours
    ) {
      corrected.push(field);
    }
  }
  return corrected;
}

function buildStyleState(
  previous: ConversationStyleState | undefined,
  message: string,
  askedField: QuoteRequiredField | undefined,
  confirmationId: string | undefined,
  copyIds: string[],
  shownVisualIds?: string[],
): ConversationStyleState {
  const prevMessages = previous?.previousAssistantMessages ?? [];
  const prevAsked = previous?.previouslyAskedFields ?? [];
  const prevCopies = previous?.usedCopyIds ?? [];
  const prevVisual = previous?.shownVisualReferenceIds ?? [];
  return {
    turnNumber: (previous?.turnNumber ?? 0) + 1,
    previousAssistantMessages: [...prevMessages, message].slice(-8),
    previouslyAskedFields: askedField
      ? [...new Set([...prevAsked, askedField])]
      : prevAsked,
    lastConfirmationId: confirmationId ?? previous?.lastConfirmationId,
    usedCopyIds: [...prevCopies, ...copyIds].slice(-24),
    shownVisualReferenceIds: shownVisualIds
      ? [...prevVisual, ...shownVisualIds].slice(-24)
      : prevVisual,
  };
}

/**
 * Selección gradual: Dani por defecto, legacy bajo demanda o fallback seguro.
 */
export function composeConversationReply(
  input: ComposeConversationReplyInput,
): ComposeConversationReplyResult {
  const engine = input.styleEngine ?? DEFAULT_CONVERSATION_STYLE_ENGINE;
  const turnNumber = (input.styleState?.turnNumber ?? 0) + 1;
  const legacyText = renderLegacyResponse({
    intent: input.intent,
    missingFields: input.missingFields,
    quoteStatus: input.quoteStatus,
    cancelActive: input.cancelActive,
  });

  if (engine === "legacy") {
    return {
      text: legacyText,
      nextQuestion:
        input.quoteStatus === "COLLECTING_INFORMATION" && input.missingFields.length > 0
          ? legacyText
          : undefined,
      styleEngineUsed: "legacy",
      fellBackToLegacy: false,
      nextStyleState: buildStyleState(
        input.styleState,
        legacyText,
        input.missingFields[0],
        undefined,
        [],
      ),
    };
  }

  const visual = detectVisualReferenceIntent(input.userMessage);
  const correctedFields = detectCorrectedFields(
    input.previousDraft,
    input.draft,
    input.fieldsLearnedThisTurn,
  );

  let selectedVisualIds: string[] | undefined;
  let visualHint: DaniResponseContext["visualReferenceIntent"];
  if (visual.requested) {
    let selectedCount = 0;
    let primaryEducationalPurpose: string | undefined;
    let selectedIds: string[] | undefined;
    if (visual.niche && isVisualReferenceNiche(visual.niche)) {
      const provider = new LocalCuratedVisualReferenceProvider();
      const selection = selectVisualReferences({
        niche: visual.niche,
        references: provider.listApprovedSync(),
        previousReferenceIds: input.styleState?.shownVisualReferenceIds,
      });
      selectedCount = selection.selected.length;
      selectedIds = selection.selected.map((r) => r.id);
      selectedVisualIds = selectedIds;
      primaryEducationalPurpose = selection.selected[0]?.educationalPurpose[0];
    }
    visualHint = {
      requested: true,
      niche: visual.niche,
      selectedCount,
      primaryEducationalPurpose,
      selectedIds,
    };
  }

  const ctx: DaniResponseContext = {
    userMessage: input.userMessage,
    detectedIntent: input.intent,
    conversationStatus: input.conversationStatus,
    draft: input.draft,
    knownFields: knownFieldsFromDraft(input.draft),
    fieldsLearnedThisTurn: input.fieldsLearnedThisTurn,
    missingFields: input.missingFields,
    previouslyAskedFields: input.styleState?.previouslyAskedFields ?? [],
    correctedFields,
    turnNumber,
    previousAssistantMessages: input.styleState?.previousAssistantMessages ?? [],
    lastConfirmationId: input.styleState?.lastConfirmationId,
    usedCopyIds: input.styleState?.usedCopyIds ?? [],
    conversationId: input.conversationId,
    quoteStatus: input.quoteStatus,
    visualReferenceIntent: visualHint,
    cancelActive: input.cancelActive,
  };

  try {
    const daniResult = renderDaniResponse(ctx);
    if (
      daniResult.warnings.includes("CRITICAL_STYLE_VIOLATION") ||
      hasCriticalStyleViolation(daniResult.message)
    ) {
      logWarn("Dani renderer fallback", { code: "CRITICAL_STYLE_VIOLATION" });
      return {
        text: legacyText,
        nextQuestion:
          input.quoteStatus === "COLLECTING_INFORMATION" && input.missingFields.length > 0
            ? legacyText
            : undefined,
        styleEngineUsed: "legacy",
        daniResult,
        fellBackToLegacy: true,
        nextStyleState: buildStyleState(
          input.styleState,
          legacyText,
          input.missingFields[0],
          undefined,
          ["FALLBACK_LEGACY"],
        ),
      };
    }

    const nextQuestion =
      daniResult.responseType === "FOLLOW_UP_QUESTION" ||
      daniResult.responseType === "CORRECTION_ACKNOWLEDGEMENT" ||
      daniResult.responseType === "CLARIFICATION"
        ? daniResult.askedField
          ? daniResult.message
          : undefined
        : undefined;

    return {
      text: daniResult.message,
      nextQuestion:
        input.quoteStatus === "COLLECTING_INFORMATION" ? nextQuestion : undefined,
      styleEngineUsed: DANI_CONVERSATION_VERSION,
      daniResult,
      fellBackToLegacy: false,
      nextStyleState: buildStyleState(
        input.styleState,
        daniResult.message,
        daniResult.askedField,
        daniResult.confirmationId,
        daniResult.appliedCopyIds,
        selectedVisualIds,
      ),
    };
  } catch {
    logWarn("Dani renderer fallback", { code: "RENDERER_EXCEPTION" });
    return {
      text: legacyText,
      nextQuestion:
        input.quoteStatus === "COLLECTING_INFORMATION" && input.missingFields.length > 0
          ? legacyText
          : undefined,
      styleEngineUsed: "legacy",
      fellBackToLegacy: true,
      nextStyleState: buildStyleState(
        input.styleState,
        legacyText,
        input.missingFields[0],
        undefined,
        ["FALLBACK_LEGACY"],
      ),
    };
  }
}
