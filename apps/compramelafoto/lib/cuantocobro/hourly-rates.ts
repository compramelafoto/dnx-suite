import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import {
  computeMonthlyAvailableHours,
  computeMonthlyBillableHours,
  getCategoryWeeklyHours,
  PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS,
  WEEKS_PER_MONTH,
} from "@/lib/cuantocobro/availability";
import {
  getEffectiveExpansionMonthly,
  getEffectiveRenewalMonthly,
} from "@/lib/cuantocobro/equipment/calculations";
import { sumPersonalExpenseGroups } from "@/lib/cuantocobro/personal-expenses";
import type { CuantoCobroProfileInput, PhotographyTimeDistribution } from "@/lib/cuantocobro/types";

function sumAmounts(...values: string[]): number {
  return values.reduce((total, value) => total + (parseCuantoCobroAmount(value) ?? 0), 0);
}

/**
 * Necesidad mensual del perfil.
 * Impuestos fijos: campo futuro en perfil; por ahora no incluido en el wizard.
 */
export function getProfileMonthlyNeed(profile: CuantoCobroProfileInput): number {
  const personalExpenses = sumPersonalExpenseGroups(profile.personalExpenseGroups);
  const businessExpenses = sumAmounts(profile.businessRent, profile.businessSoftware, profile.businessMarketing);
  const teamExpenses =
    (parseCuantoCobroAmount(profile.employeesCount) ?? 0) > 0
      ? (parseCuantoCobroAmount(profile.employeeMonthlyCost) ?? 0)
      : 0;
  const profileReserves = sumAmounts(
    String(getEffectiveRenewalMonthly(profile) + getEffectiveExpansionMonthly(profile)),
    profile.emergencyFundMonthly,
    profile.savingsGoalsMonthly,
  );
  const externalIncome =
    profile.livesOnlyFromPhotography === "no" ? (parseCuantoCobroAmount(profile.externalMonthlyIncome) ?? 0) : 0;
  return Math.max(0, personalExpenses + businessExpenses + teamExpenses + profileReserves - externalIncome);
}

/** Horas mensuales disponibles = weeklyHours × 4.33 */
export function getProfileMonthlyHours(profile: CuantoCobroProfileInput): number {
  return computeMonthlyAvailableHours(profile.weeklyHours);
}

/**
 * Único costo horario del sistema.
 * costHour = monthlyNeed / monthlyHours
 *
 * La distribución semanal de tiempo no modifica este valor.
 */
export function getProfileCostHour(profile: CuantoCobroProfileInput): number | null {
  const monthlyNeed = getProfileMonthlyNeed(profile);
  const monthlyHours = getProfileMonthlyHours(profile);
  if (monthlyHours <= 0) return null;
  return monthlyNeed / monthlyHours;
}

/** @deprecated Alias de compatibilidad — usar getProfileCostHour */
export const getCostHour = getProfileCostHour;

/**
 * Horas mensuales por categoría — solo analítica / capacidad.
 * No se usa para calcular tarifas.
 */
export function getCategoryMonthlyHours(
  profile: CuantoCobroProfileInput,
  key: keyof PhotographyTimeDistribution,
): number {
  const weeklyTotal = Math.round(parseCuantoCobroAmount(profile.weeklyHours) ?? 0);
  if (weeklyTotal <= 0) return 0;
  return getCategoryWeeklyHours(weeklyTotal, profile.timeDistribution, key) * WEEKS_PER_MONTH;
}

/** @deprecated Todas las tarifas son costHour. Mantenido por compatibilidad de imports. */
export function getFullyLoadedHourlyRate(profile: CuantoCobroProfileInput): number | null {
  return getProfileCostHour(profile);
}

/** @deprecated Todas las tarifas son costHour. El parámetro key se ignora. */
export function getCategoryHourlyRate(
  profile: CuantoCobroProfileInput,
  _key: keyof PhotographyTimeDistribution,
): number | null {
  return getProfileCostHour(profile);
}

/**
 * Tabla de tarifas por tipo de hora — compatibilidad con cliente y conceptos.
 * Todas las claves devuelven exactamente costHour.
 */
export type QuoteLaborRates = Record<keyof PhotographyTimeDistribution, number> & {
  travel: number;
  delivery: number;
};

function buildUniformLaborRates(costHour: number): QuoteLaborRates {
  const uniform = {} as Record<keyof PhotographyTimeDistribution, number>;
  for (const key of PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS) {
    uniform[key] = costHour;
  }
  return {
    ...uniform,
    travel: costHour,
    delivery: costHour,
  };
}

export function getQuoteLaborRates(profile: CuantoCobroProfileInput): QuoteLaborRates | null {
  const costHour = getProfileCostHour(profile);
  if (costHour === null) return null;
  return buildUniformLaborRates(costHour);
}

/**
 * Tarifa de referencia mostrada al fotógrafo (antes VHH por cobertura).
 * @deprecated Usar getProfileCostHour — ya no divide por horas de cobertura.
 */
export function getProfileCoverageHourlyRate(profile: CuantoCobroProfileInput): number | null {
  return getProfileCostHour(profile);
}

/** Métrica informativa: horas mensuales en coberturas. No define tarifas. */
export function getProfileMonthlyBillableHours(profile: CuantoCobroProfileInput): number {
  return computeMonthlyBillableHours(profile.weeklyHours, profile.timeDistribution);
}
