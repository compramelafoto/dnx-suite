import {
  formatCuantoCobroPriceInput,
  normalizeCuantoCobroPriceInput,
  parseCuantoCobroAmount,
} from "@/lib/cuantocobro/amount-format";
import { calculateClientCosts } from "@/lib/cuantocobro/client-calculations";
import { analyzeCameraWear } from "@/lib/cuantocobro/camera-equipment";
import { buildCameraWearPolicy, buildCameraWearWarnings, sumQuoteEstimatedShots } from "@/lib/cuantocobro/camera-wear-policy";
import { computeEquipmentSavings } from "@/lib/cuantocobro/equipment/calculations";
import { calculateQuoteSummary } from "@/lib/cuantocobro/quote-item-calculations";
import { sumOwnServiceHoursIncludingLegacy } from "@/lib/cuantocobro/quote-item-hours";
import { normalizeQuoteHoursForCalculation } from "@/lib/cuantocobro/normalize-quote-hours";
import { parseQuoteItemHours } from "@/lib/cuantocobro/quote-items";
import { getQuoteConcepts } from "@/lib/cuantocobro/quote-access";
import { getProfileCostHour, getProfileMonthlyNeed, getQuoteLaborRates } from "@/lib/cuantocobro/hourly-rates";
import {
  buildMonthlyRecoveryWarning,
  computeChosenPriceMetrics,
  computeQuoteProfitabilityMetrics,
} from "@/lib/cuantocobro/quote-profitability";
import { sumPersonalExpenseGroups } from "@/lib/cuantocobro/personal-expenses";
import {
  computeMinimumSustainablePrice,
  computeRecommendedBusinessPrice,
  getCommercialPositioningOption,
  getEffectiveCommercialPositioningId,
} from "@/lib/cuantocobro/commercial-positioning";
import {
  computeMonthlyAvailableHours,
  computeMonthlyBillableHours,
  getCategoryWeeklyHours,
  getDisplayPercentForCategoryHours,
  getTimeDistributionHoursGap,
  isTimeDistributionComplete,
  isTimeDistributionValid,
  setTimeDistributionWeeklyHours,
  sumDistributionWeeklyHours,
} from "@/lib/cuantocobro/availability";
import type {
  CuantoCobroCalculationResult,
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
  CuantoCobroQuoteItem,
  CuantoCobroStepId,
} from "@/lib/cuantocobro/types";
import { CC_WIZARD_STEPS } from "@/lib/cuantocobro/types";

export type {
  CuantoCobroCalculationResult,
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
  CuantoCobroWizardData,
} from "@/lib/cuantocobro/types";

export { CC_WIZARD_STEPS } from "@/lib/cuantocobro/types";
export { calculateQuoteSummary } from "@/lib/cuantocobro/quote-item-calculations";
export { normalizeQuoteHoursForCalculation } from "@/lib/cuantocobro/normalize-quote-hours";

export const CUANTO_COBRO_WEEKS_PER_MONTH = 4.33;
export const CUANTO_COBRO_RECOMMENDED_MULTIPLIER = 1.3;
export const CUANTO_COBRO_LOW_BILLABLE_MONTHLY_HOURS = 20;

export {
  formatCuantoCobroPriceInput,
  normalizeCuantoCobroPriceInput,
  parseCuantoCobroAmount,
} from "@/lib/cuantocobro/amount-format";

export type CuantoCobroCalculationComplete = Extract<CuantoCobroCalculationResult, { status: "complete" }>;
export type CuantoCobroCalculationIncomplete = Extract<CuantoCobroCalculationResult, { status: "incomplete" }>;

function isPositiveNumber(value: string): boolean {
  const parsed = parseCuantoCobroAmount(value);
  return parsed !== null && parsed > 0;
}

function isNonNegativeNumber(value: string): boolean {
  const parsed = parseCuantoCobroAmount(value);
  return parsed !== null && parsed >= 0;
}

function isOptionalNonNegative(value: string): boolean {
  if (!value.trim()) return true;
  return isNonNegativeNumber(value);
}

function sumAmounts(...values: string[]): number {
  return values.reduce((total, value) => total + (parseCuantoCobroAmount(value) ?? 0), 0);
}

const PROFILE_RESULT_STEPS: CuantoCobroStepId[] = [
  "currency",
  "employment",
  "personal",
  "business",
  "team",
  "availability",
  "investment",
  "emergency-fund",
  "savings-goals",
  "commercial-positioning",
];

const QUOTE_RESULT_STEPS: CuantoCobroStepId[] = ["quote-details", "quote-items"];

function getConceptMissingFields(item: CuantoCobroQuoteItem, index: number): string[] {
  const label = item.name.trim() || `Producto o servicio ${index + 1}`;
  const missing: string[] = [];

  if (!item.name.trim()) missing.push(`Nombre del producto o servicio ${index + 1}`);
  if (!isPositiveNumber(item.quantity)) missing.push(`Cantidad válida de "${label}"`);

  switch (item.itemType) {
    case "own-service": {
      const ownHours = sumOwnServiceHoursIncludingLegacy(item);
      const direct = parseCuantoCobroAmount(item.directCost) ?? 0;
      if (ownHours <= 0 && direct <= 0) {
        missing.push(`Horas o costo directo de "${label}"`);
      }
      if (!isOptionalNonNegative(item.directCost)) missing.push(`Costo directo de "${label}"`);
      break;
    }
    case "physical-product": {
      const supplier = parseCuantoCobroAmount(item.supplierCost) ?? 0;
      const packaging = parseCuantoCobroAmount(item.packagingCost) ?? 0;
      const shipping = parseCuantoCobroAmount(item.shippingCost) ?? 0;
      const production =
        parseQuoteItemHours(item.productionHours) +
        parseQuoteItemHours(item.reviewHours) +
        parseQuoteItemHours(item.correctionHours);
      if (supplier <= 0 && packaging <= 0 && shipping <= 0 && production <= 0) {
        missing.push(`Costos u horas de diseño de "${label}"`);
      }
      if (!isOptionalNonNegative(item.supplierCost)) missing.push(`Costo proveedor de "${label}"`);
      if (!isOptionalNonNegative(item.packagingCost)) missing.push(`Costo de embalaje de "${label}"`);
      if (!isOptionalNonNegative(item.shippingCost)) missing.push(`Costo de envío de "${label}"`);
      if (!isOptionalNonNegative(item.desiredMarginPercent)) {
        missing.push(`Ganancia de "${label}"`);
      }
      break;
    }
    case "outsourced": {
      if (!isPositiveNumber(item.outsourcedLaborCost)) {
        missing.push(`Costo tercerizado de "${label}"`);
      }
      if (!isOptionalNonNegative(item.managementHours)) missing.push(`Horas de gestión de "${label}"`);
      if (!isOptionalNonNegative(item.desiredMarginPercent)) {
        missing.push(`Margen del servicio tercerizado de "${label}"`);
      }
      break;
    }
    case "expense": {
      if (!isPositiveNumber(item.expenseCost)) missing.push(`Costo de "${label}"`);
      break;
    }
  }

  return missing;
}

export function getCuantoCobroMissingFields(
  stepId: CuantoCobroStepId,
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): string[] {
  switch (stepId) {
    case "currency":
      return profile.currency ? [] : ["Moneda principal"];
    case "employment":
      if (!profile.livesOnlyFromPhotography) return ["¿Vivís solo de la fotografía?"];
      if (profile.livesOnlyFromPhotography === "no" && !isNonNegativeNumber(profile.externalMonthlyIncome)) {
        return ["Ingresos externos mensuales"];
      }
      return [];
    case "personal":
      return sumPersonalExpenseGroups(profile.personalExpenseGroups) > 0
        ? []
        : ["Al menos un gasto personal con monto mayor a 0"];
    case "business": {
      const missing: string[] = [];
      if (!isNonNegativeNumber(profile.businessRent)) missing.push("Alquiler / estudio");
      if (!isNonNegativeNumber(profile.businessSoftware)) missing.push("Software y herramientas");
      return missing;
    }
    case "team": {
      const missing: string[] = [];
      if (!isNonNegativeNumber(profile.employeesCount)) missing.push("Cantidad de empleados o colaboradores");
      if (profile.employeesCount !== "0" && !isNonNegativeNumber(profile.employeeMonthlyCost)) {
        missing.push("Costo mensual del equipo");
      }
      return missing;
    }
    case "availability": {
      const missing: string[] = [];
      const weeklyTotal = parseCuantoCobroAmount(profile.weeklyHours) ?? 0;
      if (!isPositiveNumber(profile.weeklyHours)) {
        missing.push("Horas semanales dedicadas a tu actividad fotográfica");
      }
      if (!isTimeDistributionComplete(profile.timeDistribution)) {
        missing.push("Distribución del tiempo por tarea");
      } else if (!isTimeDistributionValid(profile.timeDistribution, weeklyTotal)) {
        missing.push("La suma de horas por tarea debe cubrir el total semanal");
      } else if (getCategoryWeeklyHours(weeklyTotal, profile.timeDistribution, "coverage") <= 0) {
        missing.push("Asigná al menos 1 hora semanal a Coberturas fotográficas");
      }
      return missing;
    }
    case "investment":
      return isOptionalNonNegative(profile.equipmentRenewalMonthly) ? [] : ["Aporte mensual para renovación de equipo"];
    case "emergency-fund":
      return isOptionalNonNegative(profile.emergencyFundMonthly) ? [] : ["Aporte mensual a fondo de emergencia"];
    case "savings-goals":
      return isOptionalNonNegative(profile.savingsGoalsMonthly) ? [] : ["Aporte mensual para vacaciones y ahorro"];
    case "commercial-positioning":
      return [];
    case "quote-details":
      return quote.client.jobType ? [] : ["Tipo de trabajo"];
    case "quote-items": {
      const concepts = getQuoteConcepts(quote);
      if (concepts.length === 0) return ["Al menos un producto o servicio en el presupuesto"];
      return concepts.flatMap((item, index) => getConceptMissingFields(item, index));
    }
    case "quote-financing":
      return QUOTE_RESULT_STEPS.flatMap((step) => getCuantoCobroMissingFields(step, profile, quote));
    case "result":
      return [
        ...PROFILE_RESULT_STEPS.flatMap((step) => getCuantoCobroMissingFields(step, profile, quote)),
        ...QUOTE_RESULT_STEPS.flatMap((step) => getCuantoCobroMissingFields(step, profile, quote)),
      ];
    default:
      return [];
  }
}

export function isCuantoCobroProfileComplete(
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): boolean {
  return PROFILE_RESULT_STEPS.every(
    (stepId) => getCuantoCobroMissingFields(stepId, profile, quote).length === 0,
  );
}

export function getFirstIncompleteProfileStepIndex(
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): number {
  for (const stepId of PROFILE_RESULT_STEPS) {
    if (getCuantoCobroMissingFields(stepId, profile, quote).length > 0) {
      return CC_WIZARD_STEPS.findIndex((step) => step.id === stepId);
    }
  }
  return -1;
}

export function getFirstQuoteStepIndex(): number {
  return CC_WIZARD_STEPS.findIndex((step) => step.block === "quote");
}

export function formatCuantoCobroCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-AR")} ${currency || "ARS"}`;
  }
}

export function formatCuantoCobroHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString("es-AR")} h`;
}

function buildWarnings(
  monthlyNeed: number,
  monthlyBillableHours: number,
  externalIncome: number,
  personalExpenses: number,
  businessExpenses: number,
  teamExpenses: number,
  cameraWear: ReturnType<typeof analyzeCameraWear> | null,
): string[] {
  const warnings: string[] = [];

  if (
    monthlyBillableHours > 0 &&
    monthlyBillableHours < CUANTO_COBRO_LOW_BILLABLE_MONTHLY_HOURS
  ) {
    warnings.push(
      "Tus horas mensuales facturables son muy bajas. Con poca cobertura real, cada hora facturable debe costar más para cubrir tus gastos.",
    );
  }

  const totalExpenses = personalExpenses + businessExpenses + teamExpenses;
  if (externalIncome > 0 && externalIncome >= totalExpenses) {
    warnings.push(
      "Tus ingresos externos cubren o superan tus gastos mensuales. La necesidad mensual queda en cero o negativa: el valor hora puede salir muy bajo si solo mirás la fotografía como complemento.",
    );
  } else if (monthlyNeed <= 0) {
    warnings.push(
      "Tu necesidad mensual es cero o negativa. Revisá ingresos externos y gastos antes de usar este precio como referencia.",
    );
  }

  if (cameraWear?.isConfigured && cameraWear.remainingLifePercent < 20) {
    warnings.push(
      `Tu obturador tiene aprox. ${cameraWear.remainingLifePercent}% de vida útil restante. Considerá renovar el cuerpo o aumentar el aporte mensual de equipo.`,
    );
  }

  if (
    cameraWear?.isConfigured &&
    cameraWear.jobShots > 0 &&
    cameraWear.jobWearPercentOfRemaining !== null &&
    cameraWear.jobWearPercentOfRemaining >= 5
  ) {
    warnings.push(
      `Este trabajo consumiría aprox. ${cameraWear.jobWearPercentOfRemaining}% de los disparos restantes de tu obturador.`,
    );
  }

  return warnings;
}

export function getProfileHourlyRate(profile: CuantoCobroProfileInput): number | null {
  return getProfileCostHour(profile);
}

export function calculateCuantoCobro(
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): CuantoCobroCalculationResult {
  const missingFields = getCuantoCobroMissingFields("result", profile, quote);
  if (missingFields.length > 0) {
    return { status: "incomplete", missingFields };
  }

  const personalExpenses = sumPersonalExpenseGroups(profile.personalExpenseGroups);
  const businessExpenses = sumAmounts(profile.businessRent, profile.businessSoftware, profile.businessMarketing);
  const teamExpenses =
    (parseCuantoCobroAmount(profile.employeesCount) ?? 0) > 0
      ? (parseCuantoCobroAmount(profile.employeeMonthlyCost) ?? 0)
      : 0;
  const profileReserves = sumAmounts(
    String(computeEquipmentSavings(profile).totalMonthly),
    profile.emergencyFundMonthly,
    profile.savingsGoalsMonthly,
  );
  const externalIncome =
    profile.livesOnlyFromPhotography === "no" ? (parseCuantoCobroAmount(profile.externalMonthlyIncome) ?? 0) : 0;

  const monthlyNeed = getProfileMonthlyNeed(profile);
  const weeklyTotal = Math.round(parseCuantoCobroAmount(profile.weeklyHours) ?? 0);
  const monthlyAvailableHours = computeMonthlyAvailableHours(profile.weeklyHours);
  const coverageHours = getCategoryWeeklyHours(weeklyTotal, profile.timeDistribution, "coverage");
  const coveragePercentage =
    weeklyTotal > 0 ? getDisplayPercentForCategoryHours(weeklyTotal, coverageHours) : 0;
  const monthlyBillableHours = computeMonthlyBillableHours(profile.weeklyHours, profile.timeDistribution);

  if (monthlyAvailableHours <= 0) {
    return {
      status: "incomplete",
      missingFields: ["Horas semanales dedicadas a tu actividad fotográfica"],
    };
  }

  const costHour = getProfileCostHour(profile);
  if (costHour === null) {
    return {
      status: "incomplete",
      missingFields: ["Horas semanales dedicadas a tu actividad fotográfica"],
    };
  }

  const laborRates = getQuoteLaborRates(profile);
  if (!laborRates) {
    return {
      status: "incomplete",
      missingFields: ["Horas semanales dedicadas a tu actividad fotográfica"],
    };
  }

  const cameraWearPolicy = buildCameraWearPolicy(profile);

  const { quote: normalizedQuote, warnings: hoursMigrationWarnings } =
    normalizeQuoteHoursForCalculation(quote);

  const concepts = getQuoteConcepts(normalizedQuote);
  const clientSummary = calculateClientCosts(normalizedQuote.client, laborRates);
  const quoteSummary = calculateQuoteSummary(concepts, laborRates, cameraWearPolicy);

  const cameraWearSummary = {
    mode: cameraWearPolicy.mode,
    costPerShot: cameraWearPolicy.costPerShot,
    isCameraConfigured: cameraWearPolicy.isCameraConfigured,
    totalJobShots: sumQuoteEstimatedShots(concepts),
    totalCameraWearInformative: quoteSummary.totalCameraWearInformative,
    totalCameraWearCharged: quoteSummary.totalCameraWearCharged,
  };

  const totalJobHours = clientSummary.totalHours + quoteSummary.totalOwnHours;
  const humanCost = clientSummary.laborCost + quoteSummary.totalLaborCost;
  const variableCosts = quoteSummary.totalDirectCost;
  const minimumPrice = clientSummary.suggestedPrice + quoteSummary.totalBaseCost;
  const recommendedPrice = clientSummary.suggestedPrice + quoteSummary.totalSuggestedPrice;
  const minimumSustainablePrice = computeMinimumSustainablePrice(recommendedPrice);
  const effectivePositioningId = getEffectiveCommercialPositioningId(profile.commercialPositioningId);
  const commercialPositioningLabel = getCommercialPositioningOption(profile.commercialPositioningId).title;
  const recommendedBusinessPrice = computeRecommendedBusinessPrice(
    minimumSustainablePrice,
    profile.commercialPositioningId,
  );
  const growthMargin = quoteSummary.totalMarginAmount;

  const cameraWear = analyzeCameraWear(profile, quote);
  const equipmentSavings = computeEquipmentSavings(profile);

  const chosenPriceRaw = parseCuantoCobroAmount(quote.chosenPrice ?? "");
  const chosenManualPrice = chosenPriceRaw !== null && chosenPriceRaw > 0 ? chosenPriceRaw : null;

  const profitability = computeQuoteProfitabilityMetrics({
    minimumPrice,
    recommendedPrice,
    monthlyNeed,
    clientLaborCost: clientSummary.laborCost,
    conceptLaborCost: quoteSummary.totalLaborCost,
    chosenManualPrice,
  });

  const chosenPriceMetrics = computeChosenPriceMetrics({
    minimumPrice,
    recommendedPrice: recommendedBusinessPrice,
    monthlyNeed,
    monthlyRecoveryFromJob: profitability.monthlyRecoveryFromJob,
    chosenManualPrice,
  });

  const monthlyRecoveryWarning = buildMonthlyRecoveryWarning(profitability.monthlyRecoveryFromJob);

  const warnings = [
    ...hoursMigrationWarnings,
    ...buildCameraWearWarnings(profile, cameraWearPolicy, concepts),
    ...buildWarnings(
      monthlyNeed,
      monthlyBillableHours,
      externalIncome,
      personalExpenses,
      businessExpenses,
      teamExpenses,
      cameraWear.isConfigured ? cameraWear : null,
    ),
    ...(monthlyRecoveryWarning ? [monthlyRecoveryWarning] : []),
  ];

  const hourlyRate = costHour;

  return {
    status: "complete",
    currency: profile.currency,
    personalExpenses,
    businessExpenses,
    teamExpenses,
    externalIncome,
    monthlyNeed,
    monthlyAvailableHours,
    monthlyBillableHours,
    coveragePercentage,
    hourlyRate,
    totalJobHours,
    humanCost,
    variableCosts,
    minimumPrice,
    recommendedPrice,
    minimumSustainablePrice,
    recommendedBusinessPrice,
    commercialPositioningId: effectivePositioningId,
    commercialPositioningLabel,
    growthMargin,
    estimatedMargin: profitability.estimatedMargin,
    monthlyRecoveryFromJob: profitability.monthlyRecoveryFromJob,
    servicesNeededPerMonth: profitability.servicesNeededPerMonth,
    marginRatio: profitability.marginRatio,
    profitabilityStatus: profitability.profitabilityStatus,
    chosenManualPrice: profitability.chosenManualPrice,
    chosenPriceEffective: chosenPriceMetrics.chosenPriceEffective,
    chosenMargin: chosenPriceMetrics.chosenMargin,
    chosenMarginRatio: chosenPriceMetrics.chosenMarginRatio,
    chosenMarginStatus: chosenPriceMetrics.chosenMarginStatus,
    chosenPriceDeltaFromRecommended: chosenPriceMetrics.chosenPriceDeltaFromRecommended,
    chosenPriceCommercialStatus: chosenPriceMetrics.chosenPriceCommercialStatus,
    servicesNeededPerMonthByChosenPrice: chosenPriceMetrics.servicesNeededPerMonthByChosenPrice,
    grossServicesNeededPerMonth: chosenPriceMetrics.grossServicesNeededPerMonth,
    warnings,
    cameraWear: cameraWear.isConfigured ? cameraWear : null,
    cameraWearSummary,
    equipmentSavings,
    clientSummary,
    quoteSummary,
  };
}

// Re-export availability helpers used by AvailabilityStep
export {
  getTimeDistributionHoursGap,
  isTimeDistributionComplete,
  isTimeDistributionValid,
  setTimeDistributionWeeklyHours,
  sumDistributionWeeklyHours,
};
