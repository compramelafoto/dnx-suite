import type {
  HumanResponseReview,
  HumanVisualReferenceReview,
  LabSession,
  LabTurn,
} from "../session/lab-models.js";

const LEAK_RE =
  /minimumSustainable|recommendedBusiness|hourlyRate|breakdown|monthlyNeed|personalExpenses|DNX_|API_KEY|SECRET|PASSWORD|TOKEN|(?:\/Users\/|\/home\/|[A-Za-z]:\\)/i;

export function containsSensitiveLeak(text: string): boolean {
  return LEAK_RE.test(text);
}

function sanitizeTurn(turn: LabTurn): LabTurn {
  const { diagnostics } = turn;
  return {
    turnNumber: turn.turnNumber,
    userMessage: turn.userMessage,
    assistantMessage: turn.assistantMessage,
    diagnostics: {
      intent: diagnostics.intent,
      conversationStatus: diagnostics.conversationStatus,
      quoteStatus: diagnostics.quoteStatus,
      knownFields: [...diagnostics.knownFields],
      fieldsLearnedThisTurn: [...diagnostics.fieldsLearnedThisTurn],
      correctedFields: [...diagnostics.correctedFields],
      missingFields: [...diagnostics.missingFields],
      askedField: diagnostics.askedField,
      responseType: diagnostics.responseType,
      styleVersion: diagnostics.styleVersion,
      styleEngine: diagnostics.styleEngine,
      daniScore: diagnostics.daniScore,
      flags: diagnostics.flags.map((f) => ({ ...f })),
      pricingRuntimeStatus: diagnostics.pricingRuntimeStatus,
      visualReferenceRequested: diagnostics.visualReferenceRequested,
      visualNiche: diagnostics.visualNiche,
      visualConfidence: diagnostics.visualConfidence,
      visualProvider: diagnostics.visualProvider,
      visualAuthorizedCount: diagnostics.visualAuthorizedCount,
      visualReferences: diagnostics.visualReferences?.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        niches: [...r.niches],
        orientation: r.orientation,
        educationalPurpose: [...r.educationalPurpose],
        tags: [...r.tags],
        authorName: r.authorName,
        attributionRequired: r.attributionRequired,
        attributionText: r.attributionText,
        authorizationBasis: r.authorizationBasis,
        status: r.status,
        assetUrl: r.assetUrl,
      })),
      appliedCopyIds: diagnostics.appliedCopyIds
        ? [...diagnostics.appliedCopyIds]
        : undefined,
    },
    humanReview: turn.humanReview
      ? sanitizeReview(turn.humanReview)
      : undefined,
  };
}

function sanitizeVisualReview(
  review: HumanVisualReferenceReview,
): HumanVisualReferenceReview {
  return {
    sessionId: review.sessionId,
    referenceId: review.referenceId,
    niche: review.niche,
    verdict: review.verdict,
    note: review.note,
    createdAt: review.createdAt,
  };
}

function sanitizeReview(review: HumanResponseReview): HumanResponseReview {
  return {
    conversationId: review.conversationId,
    turnNumber: review.turnNumber,
    verdict: review.verdict,
    note: review.note,
    assistantMessage: review.assistantMessage,
    styleVersion: review.styleVersion,
    askedField: review.askedField,
    createdAt: review.createdAt,
  };
}

/** Exportación segura — sin precios, breakdown ni secretos. */
export function sanitizeLabSessionExport(session: LabSession): Record<string, unknown> {
  const payload = {
    kind: "dnx-sales-assistant-review-lab-export",
    version: 1,
    disclaimer:
      "La evaluación automática orienta la revisión. La aprobación final es de Dani.",
    sessionId: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    styleEngine: session.styleEngine,
    scenarioId: session.scenarioId,
    turns: session.turns.map(sanitizeTurn),
    humanReviews: session.humanReviews.map(sanitizeReview),
    humanVisualReviews: (session.humanVisualReviews ?? []).map(sanitizeVisualReview),
    summary: buildSummary(session),
  };

  const json = JSON.stringify(payload);
  if (containsSensitiveLeak(json)) {
    throw new Error("EXPORT_SANITIZE_LEAK");
  }
  return payload;
}

export function buildSummary(session: LabSession): Record<string, unknown> {
  const scores = session.turns.map((t) => t.diagnostics.daniScore);
  const avg =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const min = scores.length === 0 ? 0 : Math.min(...scores);
  const reviews = session.humanReviews;
  const last = session.turns[session.turns.length - 1];
  const visual = session.turns.find((t) => t.diagnostics.visualReferenceRequested);

  return {
    totalTurns: session.turns.length,
    averageScore: avg,
    minimumScore: min,
    approved: reviews.filter((r) => r.verdict === "APPROVED").length,
    needsAdjustment: reviews.filter((r) => r.verdict === "NEEDS_ADJUSTMENT").length,
    incorrect: reviews.filter((r) => r.verdict === "INCORRECT").length,
    finalIntent: last?.diagnostics.intent,
    finalConversationStatus: last?.diagnostics.conversationStatus,
    finalQuoteStatus: last?.diagnostics.quoteStatus,
    finalPricingRuntimeStatus: last?.diagnostics.pricingRuntimeStatus ?? "NOT_RUN",
    visualNicheDetected: visual?.diagnostics.visualNiche,
    visualReferenceIdsShown: [
      ...new Set(
        session.turns.flatMap(
          (t) => t.diagnostics.visualReferences?.map((r) => r.id) ?? [],
        ),
      ),
    ],
    visualHumanReviews: (session.humanVisualReviews ?? []).length,
    note: "Una respuesta con score 100 puede igualmente requerir ajustes.",
  };
}
