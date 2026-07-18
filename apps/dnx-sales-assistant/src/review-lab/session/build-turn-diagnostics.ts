import { createConversationId } from "../../conversation/create-conversation-id.js";
import type { ConversationStore } from "../../conversation/conversation-store.js";
import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import type { AssistantResponse } from "../../models/assistant.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";
import { evaluateDaniStyle } from "../../evaluation/dani-style/evaluate-dani-style.js";
import { knownFieldsFromDraft } from "../../evaluation/metrics/compute-conversation-metrics.js";
import { detectVisualReferenceIntent } from "../../evaluation/visual-reference/detect-visual-reference-intent.js";
import type { ConversationTranscript } from "../../evaluation/conversation-transcript/conversation-transcript.js";
import { isVisualReferenceNiche } from "../../visual-references/domain/visual-reference-niche.js";
import { LocalCuratedVisualReferenceProvider } from "../../visual-references/provider/local-curated-visual-reference-provider.js";
import { selectVisualReferences } from "../../visual-references/selection/select-visual-references.js";
import { serializePublicVisualReference } from "../../visual-references/serialization/serialize-public-visual-reference.js";
import type { LabSession, LabTurnDiagnostics } from "./lab-models.js";

function fieldsLearned(
  before: Set<QuoteRequiredField>,
  after: Set<QuoteRequiredField>,
): QuoteRequiredField[] {
  return [...after].filter((f) => !before.has(f));
}

function correctedFields(
  prevDraft: { serviceType?: string; eventDate?: string; city?: string; durationHours?: number } | undefined,
  nextDraft: { serviceType?: string; eventDate?: string; city?: string; durationHours?: number } | undefined,
): QuoteRequiredField[] {
  if (!prevDraft || !nextDraft) return [];
  const out: QuoteRequiredField[] = [];
  if (
    prevDraft.serviceType &&
    nextDraft.serviceType &&
    prevDraft.serviceType !== nextDraft.serviceType
  ) {
    out.push("SERVICE_TYPE");
  }
  if (
    prevDraft.eventDate &&
    nextDraft.eventDate &&
    prevDraft.eventDate !== nextDraft.eventDate
  ) {
    out.push("EVENT_DATE");
  }
  if (prevDraft.city && nextDraft.city && prevDraft.city !== nextDraft.city) {
    out.push("CITY");
  }
  if (
    prevDraft.durationHours !== undefined &&
    nextDraft.durationHours !== undefined &&
    prevDraft.durationHours !== nextDraft.durationHours
  ) {
    out.push("DURATION_HOURS");
  }
  return out;
}

export async function buildTurnDiagnostics(input: {
  session: LabSession;
  userMessage: string;
  response: AssistantResponse;
  previousDraft?: {
    serviceType?: string;
    eventDate?: string;
    city?: string;
    durationHours?: number;
  };
  store: ConversationStore;
  styleEngine: ConversationStyleEngine;
  askedField?: QuoteRequiredField;
  responseType?: string;
  styleVersion?: string;
  appliedCopyIds?: string[];
}): Promise<LabTurnDiagnostics> {
  const draft = input.response.quoteRequest?.draft;
  const before = knownFieldsFromDraft(input.previousDraft);
  const after = knownFieldsFromDraft(draft);
  const learned = fieldsLearned(before, after);
  const corrected = correctedFields(input.previousDraft, draft);
  const visual = detectVisualReferenceIntent(input.userMessage);
  const previousVisualIds = input.session.turns.flatMap(
    (t) => t.diagnostics.visualReferences?.map((r) => r.id) ?? [],
  );
  let visualReferences: LabTurnDiagnostics["visualReferences"];
  let visualAuthorizedCount = 0;
  if (visual.requested && visual.niche && isVisualReferenceNiche(visual.niche)) {
    const provider = new LocalCuratedVisualReferenceProvider();
    const selection = selectVisualReferences({
      niche: visual.niche,
      references: provider.listApprovedSync(),
      previousReferenceIds: previousVisualIds,
    });
    visualAuthorizedCount = selection.availableCount;
    visualReferences = selection.selected.map(serializePublicVisualReference);
  }

  const conversationId = createConversationId(input.session.participantFrom);
  const stored = await input.store.get(conversationId);
  const pricingRuntimeStatus =
    stored?.pricingResult?.status ??
    (input.response.quoteRequest?.status === "READY_FOR_CALCULATION"
      ? "FAILED"
      : "NOT_RUN");

  const turnNumber = input.session.turns.length + 1;
  const transcript: ConversationTranscript = {
    scenarioId: input.session.id,
    turns: [
      ...input.session.turns.map((t) => ({
        turnNumber: t.turnNumber,
        userMessage: t.userMessage,
        assistantMessage: t.assistantMessage,
        extractedFields: t.diagnostics.fieldsLearnedThisTurn,
        missingFields: t.diagnostics.missingFields,
        conversationStatus: t.diagnostics.conversationStatus,
        quoteStatus: t.diagnostics.quoteStatus,
        warnings: [],
      })),
      {
        turnNumber,
        userMessage: input.userMessage,
        assistantMessage: input.response.text,
        extractedFields: learned,
        missingFields: input.response.quoteRequest?.missingFields ?? [],
        conversationStatus: input.response.memory.status,
        quoteStatus: input.response.quoteRequest?.status,
        warnings: [],
      },
    ],
    final: {
      conversationStatus: input.response.memory.status,
      quoteStatus: input.response.quoteRequest?.status,
      draft,
      intent: input.response.intent,
      missingFields: input.response.quoteRequest?.missingFields ?? [],
      pricingRuntimeStatus:
        pricingRuntimeStatus === "NOT_RUN" ? undefined : pricingRuntimeStatus,
    },
  };

  const knownBefore: Array<Set<QuoteRequiredField>> = [
    ...input.session.turns.map((t) => {
      const set = new Set<QuoteRequiredField>();
      // approximate: all known minus learned this turn from cumulative
      for (const f of t.diagnostics.knownFields) {
        if (!t.diagnostics.fieldsLearnedThisTurn.includes(f)) set.add(f);
      }
      return set;
    }),
    before,
  ];

  const style = evaluateDaniStyle(transcript, knownBefore);

  return {
    intent: input.response.intent,
    conversationStatus: input.response.memory.status,
    quoteStatus: input.response.quoteRequest?.status,
    knownFields: [...after],
    fieldsLearnedThisTurn: learned,
    correctedFields: corrected,
    missingFields: input.response.quoteRequest?.missingFields ?? [],
    askedField: input.askedField,
    responseType: input.responseType ?? input.response.responseType,
    styleVersion: input.styleVersion,
    styleEngine: input.styleEngine,
    daniScore: style.score,
    flags: style.flags.map((f) => ({
      code: f.code,
      severity: f.severity,
      explanation: f.explanation,
    })),
    pricingRuntimeStatus:
      pricingRuntimeStatus === "READY" ||
      pricingRuntimeStatus === "INCOMPLETE" ||
      pricingRuntimeStatus === "FAILED"
        ? pricingRuntimeStatus
        : "NOT_RUN",
    visualReferenceRequested: visual.requested,
    visualNiche: visual.niche,
    visualConfidence: visual.requested ? visual.confidence : undefined,
    visualProvider: visual.requested ? "LOCAL_CURATED" : undefined,
    visualAuthorizedCount: visual.requested ? visualAuthorizedCount : undefined,
    visualReferences,
    appliedCopyIds: input.appliedCopyIds,
  };
}
