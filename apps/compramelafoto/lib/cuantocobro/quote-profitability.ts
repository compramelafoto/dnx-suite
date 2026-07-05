export type ProfitabilityStatus = "loss" | "tight" | "profitable" | "unknown";

export type ChosenPriceCommercialStatus = "loss" | "below_recommended" | "at_or_above_recommended";

export type QuoteProfitabilityMetrics = {
  estimatedMargin: number;
  marginRatio: number | null;
  profitabilityStatus: ProfitabilityStatus;
  monthlyRecoveryFromJob: number;
  servicesNeededPerMonth: number | null;
  chosenManualPrice: number | null;
};

export type ChosenPriceMetrics = {
  chosenPriceEffective: number;
  chosenMargin: number;
  chosenMarginRatio: number | null;
  chosenMarginStatus: ProfitabilityStatus;
  chosenPriceDeltaFromRecommended: number;
  chosenPriceCommercialStatus: ChosenPriceCommercialStatus;
  servicesNeededPerMonthByChosenPrice: number | null;
  grossServicesNeededPerMonth: number | null;
};

const TIGHT_MARGIN_THRESHOLD = 0.1;

export function deriveProfitabilityStatus(
  minimumPrice: number,
  recommendedPrice: number,
  marginRatio: number | null,
): ProfitabilityStatus {
  if (minimumPrice <= 0 && recommendedPrice <= 0) return "unknown";
  if (recommendedPrice < minimumPrice) return "loss";
  if (marginRatio === null) return "unknown";
  if (marginRatio < TIGHT_MARGIN_THRESHOLD) return "tight";
  return "profitable";
}

export function deriveChosenMarginStatus(
  minimumPrice: number,
  chosenPriceEffective: number,
  chosenMarginRatio: number | null,
): ProfitabilityStatus {
  if (minimumPrice <= 0 && chosenPriceEffective <= 0) return "unknown";
  if (chosenPriceEffective < minimumPrice) return "loss";
  if (chosenMarginRatio === null) return "unknown";
  if (chosenMarginRatio < TIGHT_MARGIN_THRESHOLD) return "tight";
  return "profitable";
}

export function deriveChosenPriceCommercialStatus(
  minimumPrice: number,
  recommendedPrice: number,
  chosenPriceEffective: number,
): ChosenPriceCommercialStatus {
  if (chosenPriceEffective < minimumPrice) return "loss";
  if (chosenPriceEffective < recommendedPrice) return "below_recommended";
  return "at_or_above_recommended";
}

export function getProfitabilityDiagnosisMessage(status: ProfitabilityStatus): string {
  switch (status) {
    case "loss":
      return "Este presupuesto genera pérdida: el precio recomendado no cubre el costo mínimo.";
    case "tight":
      return "Presupuesto muy ajustado: el margen sobre el costo mínimo es menor al 10%.";
    case "profitable":
      return "Presupuesto rentable: el margen sobre el costo mínimo es saludable.";
    default:
      return "Completá costos y márgenes para evaluar la rentabilidad de este presupuesto.";
  }
}

export function getChosenPriceCommercialMessage(status: ChosenPriceCommercialStatus): string {
  switch (status) {
    case "loss":
      return "Genera pérdida: el precio elegido no cubre el costo mínimo.";
    case "below_recommended":
      return "Por debajo del recomendado: cubrís costos pero cobrás menos de lo sugerido.";
    case "at_or_above_recommended":
      return "Rentable según recomendado: el precio elegido alcanza o supera lo sugerido.";
  }
}

export function getChosenMarginStatusLabel(status: ProfitabilityStatus): string {
  switch (status) {
    case "loss":
      return "Pérdida";
    case "tight":
      return "Ajustado";
    case "profitable":
      return "Rentable";
    default:
      return "Sin datos";
  }
}

export function computeChosenPriceEffective(
  chosenManualPrice: number | null,
  recommendedPrice: number,
): number {
  return chosenManualPrice ?? recommendedPrice;
}

export function computeChosenPriceMetrics(input: {
  minimumPrice: number;
  recommendedPrice: number;
  monthlyNeed: number;
  monthlyRecoveryFromJob: number;
  chosenManualPrice: number | null;
}): ChosenPriceMetrics {
  const chosenPriceEffective = computeChosenPriceEffective(
    input.chosenManualPrice,
    input.recommendedPrice,
  );
  const chosenMargin = chosenPriceEffective - input.minimumPrice;
  const chosenMarginRatio = input.minimumPrice > 0 ? chosenMargin / input.minimumPrice : null;
  const servicesNeededPerMonthByChosenPrice = computeServicesNeededPerMonth(
    input.monthlyNeed,
    input.monthlyRecoveryFromJob,
  );
  const grossServicesNeededPerMonth =
    chosenPriceEffective > 0 ? input.monthlyNeed / chosenPriceEffective : null;

  return {
    chosenPriceEffective,
    chosenMargin,
    chosenMarginRatio,
    chosenMarginStatus: deriveChosenMarginStatus(
      input.minimumPrice,
      chosenPriceEffective,
      chosenMarginRatio,
    ),
    chosenPriceDeltaFromRecommended: chosenPriceEffective - input.recommendedPrice,
    chosenPriceCommercialStatus: deriveChosenPriceCommercialStatus(
      input.minimumPrice,
      input.recommendedPrice,
      chosenPriceEffective,
    ),
    servicesNeededPerMonthByChosenPrice,
    grossServicesNeededPerMonth,
  };
}

export function computeQuoteProfitabilityMetrics(input: {
  minimumPrice: number;
  recommendedPrice: number;
  monthlyNeed: number;
  clientLaborCost: number;
  conceptLaborCost: number;
  chosenManualPrice?: number | null;
}): QuoteProfitabilityMetrics {
  const estimatedMargin = input.recommendedPrice - input.minimumPrice;
  const marginRatio = input.minimumPrice > 0 ? estimatedMargin / input.minimumPrice : null;
  const monthlyRecoveryFromJob = input.clientLaborCost + input.conceptLaborCost;
  const servicesNeededPerMonth = computeServicesNeededPerMonth(
    input.monthlyNeed,
    monthlyRecoveryFromJob,
  );

  return {
    estimatedMargin,
    marginRatio,
    profitabilityStatus: deriveProfitabilityStatus(
      input.minimumPrice,
      input.recommendedPrice,
      marginRatio,
    ),
    monthlyRecoveryFromJob,
    servicesNeededPerMonth,
    chosenManualPrice: input.chosenManualPrice ?? null,
  };
}

export function computeServicesNeededPerMonth(
  monthlyNeed: number,
  monthlyRecoveryFromJob: number,
): number | null {
  if (monthlyRecoveryFromJob <= 0) return null;
  return monthlyNeed / monthlyRecoveryFromJob;
}

export function buildMonthlyRecoveryWarning(monthlyRecoveryFromJob: number): string | null {
  if (monthlyRecoveryFromJob > 0) return null;
  return "No hay horas de trabajo valoradas en este presupuesto: no se puede calcular cuántos trabajos similares necesitás por mes.";
}
