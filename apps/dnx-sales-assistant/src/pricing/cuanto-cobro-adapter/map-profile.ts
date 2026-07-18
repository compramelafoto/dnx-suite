import type { PricingConfigurationIssue, PricingProfile } from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { amountToCompatibleString } from "./amount-strings.js";
import type { CuantoCobroCompatibleProfile } from "./compatible-models.js";
import { mapPricingEquipmentToCompatibleEquipment } from "./map-equipment.js";

export type MapProfileResult =
  | { status: "OK"; profile: CuantoCobroCompatibleProfile; warnings: PricingConfigurationIssue[] }
  | { status: "INVALID"; issues: PricingConfigurationIssue[] };

function sumBusinessByCategory(
  profile: PricingProfile,
  categories: string[],
): number {
  return profile.businessExpenses
    .filter((e) => e.enabled && e.category && categories.includes(e.category))
    .reduce((s, e) => s + e.monthlyAmount, 0);
}

function sumBusinessFallback(profile: PricingProfile, exclude: Set<string>): number {
  return profile.businessExpenses
    .filter((e) => e.enabled && (!e.category || !exclude.has(e.category)))
    .reduce((s, e) => s + e.monthlyAmount, 0);
}

/**
 * PricingProfile → CuantoCobroCompatibleProfile.
 * Gastos personales → un grupo por línea habilitada (desglose, no total único).
 * Negocio → rent/software/marketing strings del motor + employees.
 */
export function mapPricingProfileToCompatibleProfile(
  profile: PricingProfile,
): MapProfileResult {
  const issues: PricingConfigurationIssue[] = [];
  const warnings: PricingConfigurationIssue[] = [];

  const dist = profile.availability.timeDistribution;
  const distSum =
    dist.coverage +
    dist.editing +
    dist.administration +
    dist.sales +
    dist.marketing +
    dist.training;
  if (Math.abs(distSum - 100) > 0.5) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_INVALID_AVAILABILITY,
        "availability.timeDistribution",
        "ERROR",
        "Distribución temporal inconsistente; no se ajusta silenciosamente.",
      ),
    );
  }

  if (profile.availability.weeklyHours <= 0) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_INVALID_AVAILABILITY,
        "availability.weeklyHours",
        "ERROR",
        "Horas semanales inválidas.",
      ),
    );
  }

  for (const exp of [...profile.personalExpenses, ...profile.businessExpenses]) {
    if (exp.monthlyAmount < 0) {
      issues.push(
        issue(
          PricingIssueCode.NEGATIVE_VALUE,
          `expense.${exp.id}`,
          "ERROR",
          "Monto negativo no mapeable.",
        ),
      );
    }
  }

  if (issues.length > 0) {
    return { status: "INVALID", issues };
  }

  const personalGroups = profile.personalExpenses
    .filter((e) => e.enabled)
    .map((e) => ({
      id: e.id,
      title: e.label,
      description: e.category,
      items: [
        {
          id: `${e.id}-amount`,
          label: e.label,
          amount: amountToCompatibleString(e.monthlyAmount),
          isCustom: true,
        },
      ],
    }));

  const rent =
    sumBusinessByCategory(profile, ["rent"]) ||
    sumBusinessByCategory(profile, ["alquiler"]);
  const software = sumBusinessByCategory(profile, ["software"]);
  const marketing = sumBusinessByCategory(profile, ["marketing"]);
  const employees = sumBusinessByCategory(profile, ["employees"]);
  const mappedCats = new Set(["rent", "alquiler", "software", "marketing", "employees"]);
  const otherBusiness = sumBusinessFallback(profile, mappedCats);
  // Otros gastos de negocio se acumulan en marketing (slot más cercano del motor).
  const businessMarketing = marketing + otherBusiness;

  const equipmentMap = mapPricingEquipmentToCompatibleEquipment(profile);
  warnings.push(...equipmentMap.warnings);

  // Vacaciones DNX: vacationReserveMonthly se suma a savingsGoals (campo unificado del motor).
  const savingsCombined =
    profile.reserves.savingsGoalsMonthly + profile.reserves.vacationReserveMonthly;

  const compatible: CuantoCobroCompatibleProfile = {
    currency: profile.currency,
    livesOnlyFromPhotography: profile.income.livesOnlyFromPhotography,
    externalMonthlyIncome: amountToCompatibleString(
      profile.income.externalMonthlyIncome,
    ),
    personalExpenseGroups: personalGroups,
    businessRent: amountToCompatibleString(rent),
    businessSoftware: amountToCompatibleString(software),
    businessMarketing: amountToCompatibleString(businessMarketing),
    employeesCount: employees > 0 ? "1" : "0",
    employeeMonthlyCost: amountToCompatibleString(employees),
    weeklyHours: amountToCompatibleString(profile.availability.weeklyHours),
    timeDistribution: {
      coverage: amountToCompatibleString(dist.coverage),
      editing: amountToCompatibleString(dist.editing),
      administration: amountToCompatibleString(dist.administration),
      sales: amountToCompatibleString(dist.sales),
      marketing: amountToCompatibleString(dist.marketing),
      training: amountToCompatibleString(dist.training),
    },
    daysPerWeek: "",
    externalWorkSituation: "",
    externalWorkWeeklyHours: "",
    equipmentRenewalMonthly: amountToCompatibleString(
      profile.reserves.equipmentRenewalMonthly,
    ),
    ...equipmentMap.primaryCamera,
    equipmentInventory: equipmentMap.inventory,
    emergencyFundMonthly: amountToCompatibleString(
      profile.reserves.emergencyFundMonthly,
    ),
    savingsGoalsMonthly: amountToCompatibleString(savingsCombined),
    commercialPositioningId: profile.commercialPositioningId,
  };

  return { status: "OK", profile: compatible, warnings };
}
