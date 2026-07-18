import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { PricingReviewResult } from "../domain/pricing-review-models.js";
import { buildDaniPricingExplanation } from "../explanation/dani-pricing-explanation-v1.js";

/** Hints de laboratorio/escenarios (no vienen del draft público aún). */
export type PricingReviewHints = {
  photographersCount?: number;
  travelIncluded?: boolean;
  durationApproximate?: boolean;
  inferredFieldCodes?: string[];
};

export function applyReviewHints(
  review: PricingReviewResult,
  hints?: PricingReviewHints,
  draft?: QuoteRequestDraft,
): PricingReviewResult {
  if (!hints) return review;

  const assumptions = [...review.assumptions];
  const components = [...review.components];
  const warnings = [...review.warnings];
  const fields = [...review.inputSummary.fields];

  if (hints.photographersCount !== undefined && hints.photographersCount >= 2) {
    const idx = assumptions.findIndex((a) => a.code === "SINGLE_PHOTOGRAPHER");
    if (idx >= 0) assumptions.splice(idx, 1);
    assumptions.push({
      code: "SECOND_PHOTOGRAPHER",
      label: "Segundo fotógrafo",
      valueDescription: `Cobertura con ${hints.photographersCount} fotógrafos (hint de laboratorio).`,
      source: "INFERENCE",
      canChangeResult: true,
    });
    const fIdx = fields.findIndex((f) => f.code === "PHOTOGRAPHERS");
    if (fIdx >= 0) {
      fields[fIdx] = {
        code: "PHOTOGRAPHERS",
        label: "Cantidad de fotógrafos",
        valueDescription: String(hints.photographersCount),
        origin: "INFERENCE",
      };
    }
    components.push({
      code: "SECOND_PHOTOGRAPHER",
      name: "Segundo fotógrafo / asistente",
      origin: "INFERENCE",
      status: "INCLUDED",
      impact: "HIGH",
      explanation: "La cobertura la realizan dos fotógrafos.",
      warnings: [],
    });
  }

  if (hints.travelIncluded) {
    const idx = assumptions.findIndex((a) => a.code === "TRAVEL_NOT_INCLUDED");
    if (idx >= 0) assumptions.splice(idx, 1);
    assumptions.push({
      code: "TRAVEL_INCLUDED",
      label: "Traslado incluido",
      valueDescription: "Se considera traslado fuera de la zona habitual.",
      source: "INFERENCE",
      canChangeResult: true,
    });
    const fIdx = fields.findIndex((f) => f.code === "TRAVEL");
    if (fIdx >= 0) {
      fields[fIdx] = {
        code: "TRAVEL",
        label: "Traslado",
        valueDescription: "Incluido (fuera de zona habitual)",
        origin: "INFERENCE",
      };
    }
    components.push({
      code: "TRAVEL",
      name: "Traslado",
      origin: "INFERENCE",
      status: "INCLUDED",
      impact: "MEDIUM",
      explanation: "Sumé el traslado porque el trabajo es fuera de tu zona habitual.",
      warnings: [],
    });
  }

  if (hints.durationApproximate) {
    assumptions.push({
      code: "DURATION_APPROXIMATE",
      label: "Duración aproximada",
      valueDescription: "Las horas todavía son aproximadas.",
      source: "INFERENCE",
      canChangeResult: true,
    });
    warnings.push({
      code: "DURATION_APPROXIMATE",
      message:
        "La duración todavía es aproximada, así que el resultado puede cambiar cuando confirmes las horas.",
      severity: "WARNING",
    });
  }

  for (const code of hints.inferredFieldCodes ?? []) {
    warnings.push({
      code: `INFERRED_${code}`,
      message: `El campo «${code}» fue inferido por el sistema; conviene confirmarlo con el fotógrafo.`,
      severity: "WARNING",
    });
  }

  const next: PricingReviewResult = {
    ...review,
    inputSummary: { fields },
    assumptions,
    components,
    warnings,
  };

  next.explanationDani = buildDaniPricingExplanation({
    status: next.status,
    draft,
    result: next.result,
    components: next.components,
    assumptions: next.assumptions,
    missingInformation: next.missingInformation,
    amountsVisible: next.amountsVisible,
  });

  if (hints.durationApproximate && next.status === "READY") {
    if (!next.explanationDani.includes("aproximada")) {
      next.explanationDani +=
        " La duración todavía es aproximada, así que el resultado puede cambiar cuando confirmes las horas.";
    }
  }

  return next;
}

