/**
 * Capacidad, costos y tarifas de «Mi estudio» (spec 2026-10-15-mi-estudio-costos-design.md, §6). PURO.
 *
 * Por persona:
 *   semanasTrabajadas = (52 − vacaciones) / 52
 *   horasMes          = días × horasDía × 4,33 × semanasTrabajadas
 *   horasVendibles    = horasMes × vendible%            (vendible vacío = 70)
 *   costoMes:
 *     employee        = sueldo × (1 + cargas%) × (aguinaldo ? 13/12 : 1) × (vacacionesPagas ? 1 : semanasTrabajadas) + insumos
 *     informal        = igual, sin cargas
 *     monotributista  = factura + insumos
 *     daily           = jornal × días × 4,33 × (vacacionesPagas ? 1 : semanasTrabajadas) + insumos
 *     per-job         = 0 (no es estructura, no suma horas)
 *     dueño           = retiro + insumos
 *
 * Estudio:
 *   base      = fijos + equipo + reservas + fijosDeImpuestos + retiro − otrasLíneas
 *   ganancia  = monto fijo  |  max(0, base) × %
 *   necesidad = max(0, base + ganancia)
 *   capacidad = Σ horasVendibles (activas, sin "per-job", con el dueño)
 *   valorHoraEstudio  = necesidad / capacidad
 *   estructuraPorHora = (necesidad − Σ costoMes de quienes tienen horas vendibles) / capacidad
 *   tarifa_p          = costoMes_p / horasVendibles_p + estructuraPorHora
 *
 * Propiedad: Σ tarifa_p × horasVendibles_p = necesidad.
 *
 * Modo «separar el local de las coberturas» (spec 2026-10-28-cuanto-cobro-local-y-coberturas-design.md, §4.3):
 * los mismos campos del desglose traen la cuenta de las coberturas, sin nada del local.
 *   necesidadNeta = max(0, gastosPersonales − sueldoDelLocal − otrosIngresos)   (reemplaza al retiro)
 *   fijos         = fijos de coberturas + compartidos × coverageSharePercent
 *   equipo        = personas de coberturas + insumos del dueño
 *   otrasLíneas   = 0 (lo reemplaza la cuenta del local)
 *   capacidad     = horas vendibles del dueño + las de personas de coberturas
 *   personas del local: sus horas propias y tarifa = su costo por hora (sin estructura); no suman capacidad.
 */
import { parseCuantoCobroAmount } from "../amount-format";
import { WEEKS_PER_MONTH } from "../availability";
import { getEffectiveExpansionMonthly, getEffectiveRenewalMonthly } from "../equipment/calculations";
import { normalizePricingExtras, parsePercent, pricingExtrasFixedMonthly } from "../pricing-extras/price-build-up";
import { sumPersonalExpenseGroups } from "../personal-expenses";
import type { CameraWearModel, CuantoCobroProfileInput } from "../types";
import { activeStudioStructure, effectiveCoverageSharePercent, parseStudioDecimal } from "./normalize";
import {
  fixedCostScope,
  personScope,
  STUDIO_DEFAULT_BILLABLE_PERCENT,
  type StudioCoverageAccount,
  type CuantoCobroStudioBreakdown,
  type CuantoCobroStudioStructure,
  type StudioPerson,
  type StudioPersonBreakdown,
} from "./types";

const amount = (v: string | undefined): number => (v === undefined ? 0 : (parseCuantoCobroAmount(v) ?? 0));
const decimal = (v: string | undefined): number => Math.max(0, parseStudioDecimal(v) ?? 0);

export function sumStudioFixedCosts(structure: Pick<CuantoCobroStudioStructure, "fixedCostGroups">): number {
  return structure.fixedCostGroups.reduce((t, g) => t + g.items.reduce((s, i) => s + amount(i.amount), 0), 0);
}

function weeksWorkedFactor(person: StudioPerson): number {
  const vac = Math.min(52, decimal(person.vacationWeeksPerYear));
  return (52 - vac) / 52;
}

function billableShare(person: StudioPerson): number {
  if (!person.billablePercent.trim()) return STUDIO_DEFAULT_BILLABLE_PERCENT / 100;
  return (parsePercent(person.billablePercent) ?? 0) / 100;
}

/** ¿Cuenta en la estructura? Activa y no "por trabajo". El dueño siempre cuenta. */
export function isInStudioStructure(person: StudioPerson): boolean {
  if (person.role === "owner") return true;
  return person.active && person.employmentType !== "per-job";
}

export function computeStudioPersonMonthlyCost(person: StudioPerson, ownerDraw: number): number {
  if (person.role === "owner") return ownerDraw + amount(person.monthlySupplies);
  if (!isInStudioStructure(person)) return 0;
  const supplies = amount(person.monthlySupplies);
  const weeks = weeksWorkedFactor(person);
  const vacationFactor = person.paidVacations ? 1 : weeks;
  switch (person.employmentType) {
    case "employee":
    case "informal": {
      const charges = person.employmentType === "employee" ? (parsePercent(person.socialChargesPercent) ?? 0) / 100 : 0;
      const sac = person.includeSac ? 13 / 12 : 1;
      return amount(person.monthlySalary) * (1 + charges) * sac * vacationFactor + supplies;
    }
    case "monotributista":
      return amount(person.monthlySalary) + supplies;
    case "daily":
      return amount(person.dailyRate) * decimal(person.workdaysPerWeek) * WEEKS_PER_MONTH * vacationFactor + supplies;
    default:
      return supplies;
  }
}

export function computeStudioPersonHours(person: StudioPerson): { monthlyHours: number; billableHours: number } {
  if (!isInStudioStructure(person)) return { monthlyHours: 0, billableHours: 0 };
  const monthlyHours = decimal(person.workdaysPerWeek) * decimal(person.hoursPerWorkday) * WEEKS_PER_MONTH * weeksWorkedFactor(person);
  return { monthlyHours, billableHours: monthlyHours * billableShare(person) };
}

/** Desglose del estudio con un bloque ya normalizado. */
export function computeStudioBreakdownFor(
  structure: CuantoCobroStudioStructure,
  profile: CuantoCobroProfileInput,
  model: CameraWearModel = "per-job",
): CuantoCobroStudioBreakdown {
  const warnings: string[] = [];
  const separated = structure.separateLocal === true ? coverageAccountBase(structure, profile) : undefined;
  const ownerDraw = separated ? separated.ownerNetNeed : amount(structure.ownerDrawMonthly);
  const fixedCosts = separated ? separated.coverageFixed + separated.sharedToCoverage : sumStudioFixedCosts(structure);
  const reserves =
    getEffectiveRenewalMonthly(profile, model) + getEffectiveExpansionMonthly(profile) + amount(profile.emergencyFundMonthly);
  const fixedFromExtras = pricingExtrasFixedMonthly(normalizePricingExtras(profile.pricingExtras));
  const otherLinesContribution = separated ? 0 : amount(structure.otherLinesMonthlyContribution);

  const rows = structure.people.map((person) => {
    const { monthlyHours, billableHours } = computeStudioPersonHours(person);
    const monthlyCost = computeStudioPersonMonthlyCost(person, ownerDraw);
    // Modo separado: las personas del local no entran en la cuenta de las coberturas.
    const inAccount = !separated || personScope(person) === "coverage";
    return { person, monthlyHours, billableHours, monthlyCost, inAccount };
  });
  const accountRows = rows.filter((r) => r.inAccount);
  if (separated) {
    separated.coverageTeamCost = accountRows.reduce((t, r) => t + (r.person.role === "owner" ? 0 : r.monthlyCost), 0);
  }

  // Equipo: todo lo que no es el retiro (sueldos e insumos, también los del dueño).
  const teamCost = accountRows.reduce((t, r) => t + r.monthlyCost, 0) - ownerDraw;
  const base = fixedCosts + teamCost + reserves + fixedFromExtras + ownerDraw - otherLinesContribution;
  const profit =
    structure.desiredProfitMode === "percent"
      ? (Math.max(0, base) * (parsePercent(structure.desiredProfitPercent) ?? 0)) / 100
      : amount(structure.desiredProfitMonthly);
  const monthlyNeed = Math.max(0, base + profit);

  const capacityHours = accountRows.reduce((t, r) => t + r.billableHours, 0);
  const totalMonthlyHours = accountRows.reduce((t, r) => t + r.monthlyHours, 0);
  const studioHourRate = capacityHours > 0 ? monthlyNeed / capacityHours : null;
  const directCostWithHours = accountRows.reduce((t, r) => t + (r.billableHours > 0 ? r.monthlyCost : 0), 0);
  const overheadPerHour = capacityHours > 0 ? (monthlyNeed - directCostWithHours) / capacityHours : null;

  const people: StudioPersonBreakdown[] = rows.map(({ person, monthlyHours, billableHours, monthlyCost, inAccount }) => {
    const costPerHour = billableHours > 0 ? monthlyCost / billableHours : null;
    // Persona del local: si se la asigna a un trabajo, se cobra a su costo, sin recargo de estructura.
    const rate = !inAccount ? costPerHour : costPerHour !== null && overheadPerHour !== null ? costPerHour + overheadPerHour : null;
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      employmentType: person.employmentType,
      inStructure: isInStudioStructure(person),
      monthlyHours,
      billableHours,
      monthlyCost,
      costPerHour,
      rate,
    };
  });

  if (capacityHours <= 0) warnings.push("El equipo no tiene horas para cobrar: cargá días y horas por día (al menos las tuyas).");
  for (const { person } of rows) {
    if (person.role === "owner" || !person.active) continue;
    const name = person.name.trim() || "Una persona del equipo";
    if (!person.employmentType) warnings.push(`${name}: falta elegir cómo está contratada.`);
    if (person.employmentType === "employee" && !person.socialChargesPercent.trim()) {
      warnings.push(`${name}: faltan las cargas sociales. Confirmá el porcentaje con tu contador.`);
    }
  }
  if (otherLinesContribution > 0 && base <= 0) {
    warnings.push("Lo que dejan otras líneas cubre toda la estructura: revisá ese monto.");
  }
  if (separated) {
    if (separated.personalNeed > 0 && separated.ownerNetNeed === 0) {
      warnings.push("Lo que te paga el local cubre todos tus gastos personales: revisá esos montos.");
    }
    const owner = structure.people.find((p) => p.role === "owner");
    const localTime = Math.min(100, decimal(structure.ownerLocalTimePercent));
    if (owner && billableShare(owner) * 100 > 100 - localTime + 1e-9) {
      warnings.push("Tu parte cobrable no puede ser mayor que el tiempo que no le das al local.");
    }
  }

  return {
    fixedCosts,
    teamCost,
    reserves,
    fixedFromExtras,
    ownerDraw,
    otherLinesContribution,
    profit,
    monthlyNeed,
    capacityHours,
    totalMonthlyHours,
    studioHourRate,
    overheadPerHour,
    people,
    warnings,
    ...(separated ? { separated } : {}),
  };
}

/** Modo separado: la parte de la cuenta de las coberturas que no depende de las personas. */
function coverageAccountBase(structure: CuantoCobroStudioStructure, profile: CuantoCobroProfileInput): StudioCoverageAccount {
  let sharedFixed = 0;
  let coverageFixed = 0;
  for (const g of structure.fixedCostGroups) {
    for (const i of g.items) {
      const scope = fixedCostScope(g.id, i);
      if (scope === "shared") sharedFixed += amount(i.amount);
      else if (scope === "coverage") coverageFixed += amount(i.amount);
    }
  }
  const personalNeed = sumPersonalExpenseGroups(profile.personalExpenseGroups);
  const localSalary = amount(structure.ownerLocalSalaryMonthly);
  const externalIncome = profile.livesOnlyFromPhotography === "no" ? amount(profile.externalMonthlyIncome) : 0;
  return {
    personalNeed,
    localSalary,
    externalIncome,
    ownerNetNeed: Math.max(0, personalNeed - localSalary - externalIncome),
    sharedFixed,
    sharedToCoverage: (sharedFixed * effectiveCoverageSharePercent(structure)) / 100,
    coverageFixed,
    coverageTeamCost: 0,
  };
}

/** Desglose del estudio si el perfil está en modo estudio; si no, null. */
export function computeStudioBreakdown(
  profile: CuantoCobroProfileInput,
  model: CameraWearModel = "per-job",
): CuantoCobroStudioBreakdown | null {
  const structure = activeStudioStructure(profile);
  return structure ? computeStudioBreakdownFor(structure, profile, model) : null;
}

/** Faltantes de cada paso del modo estudio (bloquean el cálculo). */
export function getStudioMissingFields(
  step: "studio-costs" | "studio-team" | "studio-owner" | "studio-local",
  profile: CuantoCobroProfileInput,
): string[] {
  const structure = activeStudioStructure(profile);
  if (!structure) return [];
  const missing: string[] = [];
  const invalid = (v: string) => v.trim() !== "" && parseCuantoCobroAmount(v) === null;
  switch (step) {
    case "studio-costs":
      for (const g of structure.fixedCostGroups) {
        for (const i of g.items) if (invalid(i.amount)) missing.push(`Monto de «${i.label || g.title}»`);
      }
      return missing;
    case "studio-team":
      for (const p of structure.people) {
        if (p.role === "owner" || !p.active) continue;
        const name = p.name.trim() || "una persona del equipo";
        if (!p.name.trim()) missing.push("Nombre de cada persona del equipo");
        if (!p.employmentType) {
          missing.push(`Cómo está contratada ${name}`);
          continue;
        }
        if (p.employmentType === "per-job") {
          if (amount(p.perJobRate) <= 0) missing.push(`Cuánto cobra ${name} por trabajo`);
          continue;
        }
        if (p.employmentType === "daily" ? amount(p.dailyRate) <= 0 : amount(p.monthlySalary) <= 0) {
          missing.push(p.employmentType === "daily" ? `Jornal de ${name}` : `Lo que cobra por mes ${name}`);
        }
        if (decimal(p.workdaysPerWeek) <= 0) missing.push(`Días por semana de ${name}`);
        if (decimal(p.hoursPerWorkday) <= 0) missing.push(`Horas por día de ${name}`);
      }
      return missing;
    case "studio-owner": {
      const owner = structure.people.find((p) => p.role === "owner");
      // Modo separado: el retiro no se usa (lo reemplazan los gastos personales y el sueldo del local).
      const drawInvalid = !structure.ownerDrawMonthly.trim() || parseCuantoCobroAmount(structure.ownerDrawMonthly) === null;
      if (structure.separateLocal !== true && drawInvalid) missing.push("Tu retiro por mes");
      if (!owner || decimal(owner.workdaysPerWeek) <= 0) missing.push("Tus días de trabajo por semana");
      if (!owner || decimal(owner.hoursPerWorkday) <= 0) missing.push("Tus horas por día");
      return missing;
    }
    case "studio-local": {
      if (structure.separateLocal !== true) return [];
      if (sumPersonalExpenseGroups(profile.personalExpenseGroups) <= 0) missing.push("Tus gastos personales");
      const salary = structure.ownerLocalSalaryMonthly ?? "";
      if (!salary.trim() || parseCuantoCobroAmount(salary) === null) missing.push("Lo que te paga el local");
      return missing;
    }
  }
}
