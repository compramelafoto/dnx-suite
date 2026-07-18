import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type {
  PricingAssumption,
  PricingMissingInformation,
  PricingReviewComponent,
  PricingReviewStatus,
} from "../domain/pricing-review-models.js";

export const DANI_PRICING_EXPLANATION_VERSION = "dani-pricing-explanation-v1";

export function buildDaniPricingExplanation(input: {
  status: PricingReviewStatus | "READY" | "INCOMPLETE";
  draft?: QuoteRequestDraft;
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
    const missing = (input.missingInformation ?? [])
      .map((m) => m.label.toLowerCase())
      .slice(0, 3);
    const list =
      missing.length > 0
        ? missing.join(", ")
        : "algunos datos del trabajo";
    return `Todavía me faltan datos para armar un presupuesto sólido (${list}). Cuando los tengamos, te muestro el mínimo sostenible y el precio recomendado con claridad.`;
  }

  if (input.status !== "READY" || !input.result) {
    return "Todavía no pude cerrar el cálculo con la información actual.";
  }

  const parts: string[] = [];
  const included = (input.components ?? []).filter((c) => c.status === "INCLUDED");
  const names = included
    .filter((c) =>
      ["HUMAN_COST", "VARIABLE_COSTS", "EQUIPMENT", "BUSINESS_STRUCTURE"].includes(
        c.code,
      ),
    )
    .map((c) => {
      if (c.code === "HUMAN_COST") return "las horas de cobertura, la edición y la preparación";
      if (c.code === "VARIABLE_COSTS") return "los gastos del trabajo";
      if (c.code === "EQUIPMENT") return "la parte del equipo";
      if (c.code === "BUSINESS_STRUCTURE") return "la parte proporcional de tus gastos profesionales";
      return c.name.toLowerCase();
    });

  const unique = [...new Set(names)];
  parts.push(
    `Para este trabajo estoy teniendo en cuenta ${unique.join(", ")}.`,
  );

  if (input.draft?.durationHours !== undefined) {
    parts.push(
      `La cobertura que me pasaste es de ${input.draft.durationHours} horas.`,
    );
  }

  if (input.draft?.city) {
    parts.push(`El trabajo es en ${input.draft.city}.`);
  }

  const travelIncluded = (input.assumptions ?? []).find(
    (a) => a.code === "TRAVEL_INCLUDED",
  );
  const travelNotIncluded = (input.assumptions ?? []).find(
    (a) => a.code === "TRAVEL_NOT_INCLUDED",
  );
  if (travelIncluded) {
    parts.push(
      "Sumé el traslado porque el trabajo es fuera de tu zona habitual.",
    );
  } else if (travelNotIncluded) {
    parts.push(
      "Por ahora no sumé traslado extra; si el lugar está fuera de tu zona habitual, lo podemos ajustar.",
    );
  }

  const secondPhoto = (input.assumptions ?? []).find(
    (a) => a.code === "SECOND_PHOTOGRAPHER",
  );
  if (secondPhoto) {
    parts.push("Acá también estoy considerando que la cobertura la hacen dos fotógrafos.");
  }

  if (input.amountsVisible) {
    parts.push(
      `El primer valor es el mínimo sostenible (${input.result.currency} ${Math.round(input.result.minimumSustainable)}): no debería bajar de ahí. El segundo es el precio recomendado (${input.result.currency} ${Math.round(input.result.recommendedPrice)}), que ya incorpora tu decisión comercial (factor ${input.result.commercialFactor}).`,
    );
  } else {
    parts.push(
      "El primer valor es el mínimo para que el trabajo sea sostenible. El segundo es el precio recomendado para que además tenga margen de negocio. El recomendado nunca debería quedar por debajo del mínimo.",
    );
  }

  const softAssumptions = (input.assumptions ?? []).filter((a) => a.canChangeResult);
  if (softAssumptions.length > 0) {
    parts.push(
      `Hay supuestos que pueden cambiar el resultado (por ejemplo: ${softAssumptions[0]?.label.toLowerCase()}).`,
    );
  }

  return parts.join(" ");
}
