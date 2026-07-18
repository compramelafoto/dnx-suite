import type {
  PricingConfigurationIssue,
  PricingProfile,
  PricingProfileReadiness,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue, looksLikePlaceholder, missingFieldsFromIssues } from "../issues.js";
import { pricingProfileSchema } from "./profile-schema.js";

function deriveBillableHoursWeekly(profile: PricingProfile): number {
  if (
    typeof profile.availability.billableHoursWeekly === "number" &&
    Number.isFinite(profile.availability.billableHoursWeekly)
  ) {
    return profile.availability.billableHoursWeekly;
  }
  const { weeklyHours, timeDistribution } = profile.availability;
  return (weeklyHours * timeDistribution.coverage) / 100;
}

/**
 * Readiness comercial del perfil.
 * Estructuralmente válido ≠ listo para calcular.
 */
export function validatePricingProfileReadiness(
  profile: PricingProfile,
): PricingProfileReadiness {
  const parsed = pricingProfileSchema.safeParse(profile);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) =>
      issue(
        PricingIssueCode.SCHEMA_INVALID,
        i.path.join(".") || "profile",
        "ERROR",
        i.message,
      ),
    );
    return {
      ready: false,
      configured: Boolean((profile as { configured?: boolean }).configured),
      errors,
      warnings: [],
      missingFields: missingFieldsFromIssues(errors),
    };
  }

  const data = parsed.data;
  const errors: PricingConfigurationIssue[] = [];
  const warnings: PricingConfigurationIssue[] = [];

  if (!data.configured) {
    errors.push(
      issue(
        PricingIssueCode.PROFILE_NOT_CONFIGURED,
        "configured",
        "ERROR",
        "El perfil no está marcado como configurado.",
      ),
    );
  }

  if (!data.profileVersion.trim() || data.profileVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.PROFILE_VERSION_MISSING,
        "profileVersion",
        "ERROR",
        "Falta una versión de perfil válida.",
      ),
    );
  }

  if (!data.formulaVersion.trim() || data.formulaVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.FORMULA_VERSION_MISSING,
        "formulaVersion",
        "ERROR",
        "Falta una versión de fórmula válida.",
      ),
    );
  }

  if (!data.currency.trim()) {
    errors.push(
      issue(
        PricingIssueCode.CURRENCY_MISSING,
        "currency",
        "ERROR",
        "Falta la moneda.",
      ),
    );
  }

  if (!data.commercialPositioningId) {
    errors.push(
      issue(
        PricingIssueCode.COMMERCIAL_POSITIONING_MISSING,
        "commercialPositioningId",
        "ERROR",
        "Falta el posicionamiento comercial.",
      ),
    );
  }

  if (looksLikePlaceholder(data.name) || looksLikePlaceholder(data.notes ?? "")) {
    errors.push(
      issue(
        PricingIssueCode.PLACEHOLDER_VALUE,
        "name",
        "ERROR",
        "Hay valores placeholder pendientes de confirmación humana.",
      ),
    );
  }

  const enabledPersonal = data.personalExpenses.filter(
    (e) => e.enabled && e.monthlyAmount > 0,
  );
  if (enabledPersonal.length === 0) {
    errors.push(
      issue(
        PricingIssueCode.PERSONAL_EXPENSES_EMPTY,
        "personalExpenses",
        "ERROR",
        "Se requiere al menos un gasto personal habilitado mayor que cero.",
      ),
    );
  }

  if (
    !Number.isFinite(data.availability.weeklyHours) ||
    data.availability.weeklyHours <= 0
  ) {
    errors.push(
      issue(
        PricingIssueCode.WEEKLY_HOURS_INVALID,
        "availability.weeklyHours",
        "ERROR",
        "Las horas semanales deben ser mayores que cero.",
      ),
    );
  }

  const dist = data.availability.timeDistribution;
  const distSum =
    dist.coverage +
    dist.editing +
    dist.administration +
    dist.sales +
    dist.marketing +
    dist.training;
  if (Math.abs(distSum - 100) > 0.5) {
    errors.push(
      issue(
        PricingIssueCode.TIME_DISTRIBUTION_INVALID,
        "availability.timeDistribution",
        "ERROR",
        "La distribución de tiempo debe sumar aproximadamente 100%.",
      ),
    );
  }

  const billable = deriveBillableHoursWeekly(data);
  if (!Number.isFinite(billable) || billable <= 0) {
    errors.push(
      issue(
        PricingIssueCode.BILLABLE_HOURS_INVALID,
        "availability.billableHoursWeekly",
        "ERROR",
        "Las horas facturables semanales deben ser mayores que cero.",
      ),
    );
  } else if (billable > data.availability.weeklyHours + 1e-9) {
    errors.push(
      issue(
        PricingIssueCode.BILLABLE_HOURS_INVALID,
        "availability.billableHoursWeekly",
        "ERROR",
        "Las horas facturables no pueden superar las horas semanales totales.",
      ),
    );
  }

  const checkNonNegative = (value: number, path: string) => {
    if (Number.isFinite(value) && value < 0) {
      errors.push(
        issue(
          PricingIssueCode.NEGATIVE_VALUE,
          path,
          "ERROR",
          "No se permiten valores negativos.",
        ),
      );
    }
  };

  checkNonNegative(data.income.externalMonthlyIncome, "income.externalMonthlyIncome");
  data.personalExpenses.forEach((e, i) => {
    checkNonNegative(e.monthlyAmount, `personalExpenses[${i}].monthlyAmount`);
  });
  data.businessExpenses.forEach((e, i) => {
    checkNonNegative(e.monthlyAmount, `businessExpenses[${i}].monthlyAmount`);
  });
  checkNonNegative(data.reserves.equipmentRenewalMonthly, "reserves.equipmentRenewalMonthly");
  checkNonNegative(data.reserves.emergencyFundMonthly, "reserves.emergencyFundMonthly");
  checkNonNegative(data.reserves.savingsGoalsMonthly, "reserves.savingsGoalsMonthly");
  checkNonNegative(data.reserves.vacationReserveMonthly, "reserves.vacationReserveMonthly");

  const enabledBusiness = data.businessExpenses.filter((e) => e.enabled);
  const businessTotal = enabledBusiness.reduce((s, e) => s + e.monthlyAmount, 0);
  if (enabledBusiness.length === 0 || businessTotal === 0) {
    warnings.push(
      issue(
        PricingIssueCode.BUSINESS_EXPENSES_ALL_ZERO,
        "businessExpenses",
        "WARNING",
        "Todos los gastos del negocio están en cero o deshabilitados.",
      ),
    );
  }

  const personalTotal = enabledPersonal.reduce((s, e) => s + e.monthlyAmount, 0);
  const reservesTotal =
    data.reserves.equipmentRenewalMonthly +
    data.reserves.emergencyFundMonthly +
    data.reserves.savingsGoalsMonthly +
    data.reserves.vacationReserveMonthly;
  const needApprox = personalTotal + businessTotal + reservesTotal;
  if (
    data.income.livesOnlyFromPhotography === "no" &&
    data.income.externalMonthlyIncome >= needApprox &&
    needApprox > 0
  ) {
    warnings.push(
      issue(
        PricingIssueCode.EXTERNAL_INCOME_HIGH,
        "income.externalMonthlyIncome",
        "WARNING",
        "Los ingresos externos cubren o superan la necesidad aproximada.",
      ),
    );
  }

  if (data.equipment.length === 0) {
    warnings.push(
      issue(
        PricingIssueCode.EQUIPMENT_EMPTY,
        "equipment",
        "WARNING",
        "Inventario de equipo vacío.",
      ),
    );
  } else {
    const enabledEquip = data.equipment.filter((e) => e.enabled);
    const missingReplacement = enabledEquip.some(
      (e) =>
        e.replacementValue === undefined ||
        e.replacementValue === null ||
        (typeof e.replacementValue === "number" && e.replacementValue <= 0),
    );
    if (missingReplacement) {
      warnings.push(
        issue(
          PricingIssueCode.EQUIPMENT_REPLACEMENT_UNCONFIGURED,
          "equipment",
          "WARNING",
          "Hay equipos habilitados sin valor de reposición configurado.",
        ),
      );
    }
  }

  if (data.reserves.emergencyFundMonthly === 0) {
    warnings.push(
      issue(
        PricingIssueCode.RESERVE_EMERGENCY_ZERO,
        "reserves.emergencyFundMonthly",
        "WARNING",
        "Fondo de emergencia en cero.",
      ),
    );
  }
  if (data.reserves.savingsGoalsMonthly === 0) {
    warnings.push(
      issue(
        PricingIssueCode.RESERVE_SAVINGS_ZERO,
        "reserves.savingsGoalsMonthly",
        "WARNING",
        "Ahorro en cero.",
      ),
    );
  }
  if (data.reserves.vacationReserveMonthly === 0) {
    warnings.push(
      issue(
        PricingIssueCode.RESERVE_VACATION_ZERO,
        "reserves.vacationReserveMonthly",
        "WARNING",
        "Reserva de vacaciones en cero.",
      ),
    );
  }
  if (data.reserves.equipmentRenewalMonthly === 0) {
    warnings.push(
      issue(
        PricingIssueCode.RESERVE_EQUIPMENT_ZERO,
        "reserves.equipmentRenewalMonthly",
        "WARNING",
        "Reserva de renovación de equipo en cero.",
      ),
    );
  }

  return {
    ready: errors.length === 0,
    configured: data.configured,
    errors,
    warnings,
    missingFields: missingFieldsFromIssues(errors),
  };
}
