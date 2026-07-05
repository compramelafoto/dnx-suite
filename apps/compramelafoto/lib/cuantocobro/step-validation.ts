import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import {
  getTimeDistributionHoursGap,
  isTimeDistributionComplete,
  isTimeDistributionValid,
} from "@/lib/cuantocobro/availability";
import { getCuantoCobroMissingFields } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { CuantoCobroProfileInput, CuantoCobroQuoteInput, CuantoCobroStepId } from "@/lib/cuantocobro/types";

export type CuantoCobroStepValidationStatus = "complete" | "incomplete" | "error";

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

function hasInvalidAmount(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = parseCuantoCobroAmount(value);
  return parsed === null || parsed < 0;
}

export function hasCuantoCobroStepValidationError(
  stepId: CuantoCobroStepId,
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): boolean {
  switch (stepId) {
    case "currency":
      return false;
    case "employment":
      return (
        profile.livesOnlyFromPhotography === "no" &&
        profile.externalMonthlyIncome.trim() !== "" &&
        !isNonNegativeNumber(profile.externalMonthlyIncome)
      );
    case "personal":
      return false;
    case "business":
      return hasInvalidAmount(profile.businessRent) || hasInvalidAmount(profile.businessSoftware);
    case "team":
      return (
        (profile.employeesCount.trim() !== "" && !isNonNegativeNumber(profile.employeesCount)) ||
        (profile.employeesCount !== "0" &&
          profile.employeeMonthlyCost.trim() !== "" &&
          !isNonNegativeNumber(profile.employeeMonthlyCost))
      );
    case "availability": {
      const weeklyTotal = Math.round(parseCuantoCobroAmount(profile.weeklyHours) ?? 0);
      const weeklyFilled = profile.weeklyHours.trim() !== "";
      if (weeklyFilled && !isPositiveNumber(profile.weeklyHours)) return true;
      if (weeklyTotal > 0 && isTimeDistributionComplete(profile.timeDistribution)) {
        if (!isTimeDistributionValid(profile.timeDistribution, weeklyTotal)) return true;
        if (getTimeDistributionHoursGap(weeklyTotal, profile.timeDistribution).overflow > 0) return true;
      }
      return false;
    }
    case "investment":
      return (
        hasInvalidAmount(profile.equipmentRenewalMonthly) ||
        hasInvalidAmount(profile.primaryCameraReplacementValue) ||
        hasInvalidAmount(profile.primaryCameraCurrentShutterCount) ||
        (profile.primaryCameraShutterRating.trim() !== "" &&
          !isNonNegativeNumber(profile.primaryCameraShutterRating))
      );
    case "emergency-fund":
      return hasInvalidAmount(profile.emergencyFundMonthly);
    case "savings-goals":
      return hasInvalidAmount(profile.savingsGoalsMonthly);
    case "commercial-positioning":
      return false;
    case "quote-details":
      return false;
    case "quote-items":
      return quote.concepts.some(
        (item) =>
          (item.quantity.trim() !== "" && !isPositiveNumber(item.quantity)) ||
          !isOptionalNonNegative(item.directCost) ||
          !isOptionalNonNegative(item.supplierCost) ||
          !isOptionalNonNegative(item.outsourcedLaborCost) ||
          !isOptionalNonNegative(item.expenseCost) ||
          !isOptionalNonNegative(item.desiredMarginPercent),
      );
    case "quote-financing":
      return hasCuantoCobroStepValidationError("quote-items", profile, quote);
    case "result": {
      const steps: CuantoCobroStepId[] = [
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
        "quote-details",
        "quote-items",
        "quote-financing",
      ];
      return steps.some((id) => hasCuantoCobroStepValidationError(id, profile, quote));
    }
    default:
      return false;
  }
}

export function getCuantoCobroStepValidationStatus(
  stepId: CuantoCobroStepId,
  profile: CuantoCobroProfileInput,
  quote: CuantoCobroQuoteInput,
): CuantoCobroStepValidationStatus {
  const missing = getCuantoCobroMissingFields(stepId, profile, quote);
  if (missing.length === 0) return "complete";
  if (hasCuantoCobroStepValidationError(stepId, profile, quote)) return "error";
  return "incomplete";
}

export const CUANTO_COBRO_STEP_VALIDATION_LABELS: Record<CuantoCobroStepValidationStatus, string> = {
  complete: "Completado",
  incomplete: "Falta completar",
  error: "Revisar datos",
};
