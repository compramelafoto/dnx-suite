import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { PricingCalculationResult } from "../../pricing/calculation-contract.js";
import type { PricingProfile } from "../../pricing/models.js";
import type { PricingReviewResult } from "../domain/pricing-review-models.js";
import { buildPricingInputSummary } from "./build-input-summary.js";
import { buildDaniPricingExplanation } from "../explanation/dani-pricing-explanation-v1.js";
import { buildStructuredPricingExplanation } from "../explanation/structured-pricing-explanation.js";

/** Factor comercial observado en el resultado (no recalcula; no importa el core). */
function commercialFactorFromResult(
  minimum: number,
  recommended: number,
): number {
  if (!(minimum > 0) || !Number.isFinite(recommended)) return 1;
  return Math.round((recommended / minimum) * 100) / 100;
}

function componentsFromReady(
  calculation: Extract<PricingCalculationResult, { status: "READY" }>,
  draft?: QuoteRequestDraft,
): PricingReviewResult["components"] {
  const b = calculation.breakdown;
  const components: PricingReviewResult["components"] = [
    {
      code: "HUMAN_COST",
      name: "Tiempo de trabajo (cobertura, edición y gestión)",
      origin: "PROFILE",
      status: "INCLUDED",
      impact: "HIGH",
      explanation:
        "Incluye la parte del tiempo profesional asociada al trabajo según tu perfil y la duración informada.",
      warnings: [],
    },
    {
      code: "VARIABLE_COSTS",
      name: "Gastos variables del trabajo",
      origin: "PROFILE",
      status: b.variableCosts > 0 ? "INCLUDED" : "NOT_APPLICABLE",
      impact: "MEDIUM",
      explanation:
        "Gastos propios del trabajo cuando están configurados en el perfil o la plantilla.",
      warnings: [],
    },
    {
      code: "EQUIPMENT",
      name: "Amortización / desgaste de equipo",
      origin: "PROFILE",
      status:
        b.totalCameraWearCharged > 0 || b.equipmentSavingsMonthly > 0
          ? "INCLUDED"
          : "NOT_APPLICABLE",
      impact: "MEDIUM",
      explanation:
        "Parte proporcional del equipo y reservas de renovación según tu configuración.",
      warnings: [],
    },
    {
      code: "BUSINESS_STRUCTURE",
      name: "Estructura del negocio",
      origin: "PROFILE",
      status: "INCLUDED",
      impact: "HIGH",
      explanation:
        "Gastos profesionales, reservas y necesidad mensual que sostienen el estudio.",
      warnings: [],
    },
    {
      code: "COMMERCIAL_MARGIN",
      name: "Factor / margen comercial",
      origin: "PROFILE",
      status: "INCLUDED",
      impact: "HIGH",
      explanation:
        "Diferencia entre el mínimo sostenible y el precio recomendado de negocio.",
      warnings: [],
    },
  ];

  if (draft?.durationHours !== undefined && draft.durationHours >= 8) {
    components.push({
      code: "COVERAGE_HOURS",
      name: "Cobertura prolongada",
      origin: "PHOTOGRAPHER",
      status: "INCLUDED",
      impact: "HIGH",
      explanation: `Se consideran ${draft.durationHours} horas de cobertura informadas.`,
      warnings: [],
    });
  }

  return components;
}

/**
 * Deriva la vista de revisión exclusivamente del resultado real del engine/core.
 * No recalcula fórmulas.
 */
export function mapCalculationToPricingReview(input: {
  calculation: PricingCalculationResult | null;
  draft?: QuoteRequestDraft;
  profile?: PricingProfile;
  configStatus: "READY" | "NOT_CONFIGURED" | "ERROR";
  amountsVisible?: boolean;
}): PricingReviewResult {
  const { inputSummary, assumptions, missingInformation } =
    buildPricingInputSummary({
      draft: input.draft,
      profile: input.profile,
    });

  const base = {
    explanationVersion: "dani-pricing-explanation-v1" as const,
    inputSummary,
    assumptions,
    missingInformation,
    amountsVisible: input.amountsVisible === true,
  };

  if (input.configStatus === "NOT_CONFIGURED") {
    const review: PricingReviewResult = {
      ...base,
      status: "NOT_CONFIGURED",
      components: [],
      warnings: [
        {
          code: "PROFILE_NOT_CONFIGURED",
          message:
            "El perfil económico local todavía no está configurado. Verificá con: pnpm --filter dnx-sales-assistant pricing:checklist",
          severity: "WARNING",
        },
      ],
      explanationStructured:
        "Todavía no hay perfil económico local. No se puede revisar un cálculo real.",
      explanationDani:
        "Todavía no tengo tu configuración económica cargada en este entorno. Cuando armes el perfil local, acá vas a poder revisar el mínimo sostenible y el recomendado con calma.",
    };
    return review;
  }

  if (!input.calculation) {
    return {
      ...base,
      status: "FAILED",
      components: [],
      warnings: [
        {
          code: "NO_CALCULATION",
          message: "No hay resultado de cálculo disponible.",
          severity: "ERROR",
        },
      ],
      explanationStructured: "Sin resultado de cálculo.",
      explanationDani:
        "Todavía no pude armar el cálculo. Revisá que estén los datos del trabajo y el perfil local.",
    };
  }

  const calc = input.calculation;

  if (calc.status === "INCOMPLETE") {
    const review: PricingReviewResult = {
      ...base,
      status: "INCOMPLETE",
      calculationVersion: calc.formulaVersion,
      components: [],
      warnings: calc.issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity === "ERROR" ? "ERROR" : "WARNING",
      })),
      explanationStructured: buildStructuredPricingExplanation({
        status: "INCOMPLETE",
        missingInformation,
        assumptions,
      }),
      explanationDani: buildDaniPricingExplanation({
        status: "INCOMPLETE",
        draft: input.draft,
        missingInformation,
        assumptions,
      }),
    };
    return review;
  }

  if (calc.status === "FAILED") {
    return {
      ...base,
      status: "FAILED",
      calculationVersion: calc.formulaVersion,
      components: [],
      warnings: calc.issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: "ERROR" as const,
      })),
      explanationStructured: "El motor no pudo completar el cálculo.",
      explanationDani:
        "El cálculo no pudo cerrarse con la configuración actual. Revisá el perfil y los datos del trabajo antes de sacar conclusiones.",
    };
  }

  const result = {
    minimumSustainable: calc.minimumSustainablePrice,
    recommendedPrice: calc.recommendedBusinessPrice,
    commercialFactor: commercialFactorFromResult(
      calc.minimumSustainablePrice,
      calc.recommendedBusinessPrice,
    ),
    currency: calc.currency,
  };

  const components = componentsFromReady(calc, input.draft);

  return {
    ...base,
    status: "READY",
    calculationVersion: calc.formulaVersion,
    result,
    components,
    warnings: calc.warnings.map((w) => ({
      code: w.code,
      message: w.message,
      severity: w.severity === "ERROR" ? ("ERROR" as const) : ("WARNING" as const),
    })),
    explanationStructured: buildStructuredPricingExplanation({
      status: "READY",
      result,
      components,
      assumptions,
      missingInformation,
      amountsVisible: base.amountsVisible,
    }),
    explanationDani: buildDaniPricingExplanation({
      status: "READY",
      draft: input.draft,
      result,
      components,
      assumptions,
      missingInformation,
      amountsVisible: base.amountsVisible,
    }),
  };
}
