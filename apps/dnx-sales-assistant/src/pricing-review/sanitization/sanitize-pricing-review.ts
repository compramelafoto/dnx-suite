import type {
  HumanPricingExplanationReview,
  PricingReviewResult,
} from "../domain/pricing-review-models.js";

export type PricingReviewLabPayload = Omit<PricingReviewResult, "result"> & {
  result?: {
    minimumSustainable?: number;
    recommendedPrice?: number;
    commercialFactor: number;
    currency: string;
    amountsHidden: boolean;
  };
};

/**
 * Vista segura para UI/API: oculta importes salvo reveal explícito.
 * Nunca incluye perfil completo ni rutas absolutas.
 */
export function sanitizePricingReviewForLab(
  review: PricingReviewResult,
  options?: { revealAmounts?: boolean },
): PricingReviewLabPayload {
  const reveal = options?.revealAmounts === true;
  if (reveal) {
    return {
      ...review,
      amountsVisible: true,
      result: review.result
        ? { ...review.result, amountsHidden: false }
        : undefined,
    };
  }

  return {
    ...review,
    amountsVisible: false,
    result: review.result
      ? {
          commercialFactor: review.result.commercialFactor,
          currency: review.result.currency,
          amountsHidden: true,
        }
      : undefined,
    explanationDani: review.explanationDani,
    explanationStructured: stripAmountHints(review.explanationStructured),
  };
}

/** Para export financiero local — incluye montos pero sin secretos/rutas/perfil completo. */
export function sanitizePricingReviewExport(input: {
  review: PricingReviewResult;
  humanReview?: HumanPricingExplanationReview;
  sessionId?: string;
  scenarioId?: string;
}): Record<string, unknown> {
  const { review } = input;
  return {
    kind: "pricing-review-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    status: review.status,
    calculationVersion: review.calculationVersion,
    explanationVersion: review.explanationVersion,
    inputSummary: review.inputSummary,
    assumptions: review.assumptions,
    missingInformation: review.missingInformation,
    result: review.result,
    components: review.components.map((c) => ({
      code: c.code,
      name: c.name,
      origin: c.origin,
      status: c.status,
      impact: c.impact,
      explanation: c.explanation,
      warnings: c.warnings,
    })),
    warnings: review.warnings,
    explanationStructured: review.explanationStructured,
    explanationDani: review.explanationDani,
    humanReview: input.humanReview
      ? {
          verdict: input.humanReview.verdict,
          code: input.humanReview.code,
          note: input.humanReview.note,
          explanationVersion: input.humanReview.explanationVersion,
          createdAt: input.humanReview.createdAt,
        }
      : undefined,
    exclusions: [
      "secrets",
      "tokens",
      "env",
      "absolutePaths",
      "fullEconomicProfile",
      "unnecessaryPersonalData",
    ],
  };
}

function stripAmountHints(text: string): string {
  return text
    .replace(/Mínimo sostenible:.*$/gim, "Mínimo sostenible: [oculto]")
    .replace(/Recomendado:.*$/gim, "Recomendado: [oculto]");
}

export function payloadLooksLikePublicPriceLeak(payload: unknown): boolean {
  const blob = JSON.stringify(payload);
  return (
    blob.includes("minimumSustainablePrice") ||
    blob.includes("recommendedBusinessPrice") ||
    blob.includes('"breakdown"')
  );
}
