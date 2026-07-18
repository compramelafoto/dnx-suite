import type {
  PricingAssumption,
  PricingMissingInformation,
  PricingReviewComponent,
} from "../domain/pricing-review-models.js";

export function buildStructuredPricingExplanation(input: {
  status: "READY" | "INCOMPLETE";
  result?: {
    minimumSustainable: number;
    recommendedPrice: number;
    commercialFactor: number;
    currency: string;
  };
  components?: PricingReviewComponent[];
  assumptions?: PricingAssumption[];
  missingInformation?: PricingMissingInformation[];
  amountsVisible?: boolean;
}): string {
  if (input.status === "INCOMPLETE") {
    const miss = (input.missingInformation ?? [])
      .map((m) => `- ${m.label}: ${m.whyNeeded}`)
      .join("\n");
    return `Estado: incompleto.\nFaltantes:\n${miss || "- (ver conversación)"}`;
  }

  const comps = (input.components ?? [])
    .filter((c) => c.status === "INCLUDED")
    .map((c) => `- ${c.name}`)
    .join("\n");
  const assumptions = (input.assumptions ?? [])
    .map((a) => `- ${a.label}: ${a.valueDescription}`)
    .join("\n");

  const amounts = input.amountsVisible && input.result
    ? `Mínimo sostenible: ${input.result.currency} ${input.result.minimumSustainable}\nRecomendado: ${input.result.currency} ${input.result.recommendedPrice}\nFactor comercial: ${input.result.commercialFactor}\n`
    : "Importes: ocultos (activar «Mostrar valores internos» en el laboratorio).\n";

  return [
    "Estado: listo.",
    amounts.trim(),
    "Componentes:",
    comps || "- (ninguno listado)",
    "Supuestos:",
    assumptions || "- (ninguno)",
  ].join("\n");
}
