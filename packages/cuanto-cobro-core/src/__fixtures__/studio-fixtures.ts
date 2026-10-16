/**
 * Fixtures de «Mi estudio» (spec 2026-10-15-mi-estudio-costos-design.md, §6.3 y §0.1).
 * Números de la spec y los que dio Daniel el 16/10 (con 8 h por día supuestas).
 */
import { createBaseCompleteProfile } from "./characterization-fixtures";
import type { CuantoCobroProfileInput } from "../types";
import {
  createDefaultStudioFixedCostGroups,
  createStudioOwner,
  createStudioPerson,
  INITIAL_STUDIO_STRUCTURE,
  type CuantoCobroStudioStructure,
  type StudioFixedCostGroup,
} from "../studio/types";

/** Gastos fijos de la spec (§4.1): $980.000. */
export function fijosSpec(): StudioFixedCostGroup[] {
  const montos: Record<string, string> = {
    rent: "450000",
    "power-gas-water": "120000",
    "internet-phone": "40000",
    software: "60000",
    ads: "150000",
    accountant: "80000",
    cleaning: "50000",
    "premises-insurance": "30000",
  };
  return createDefaultStudioFixedCostGroups().map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, amount: montos[i.id] ?? "" })),
  }));
}

export function estudio(overrides: Partial<CuantoCobroStudioStructure> = {}): CuantoCobroStudioStructure {
  return { ...INITIAL_STUDIO_STRUCTURE, enabled: true, fixedCostGroups: fijosSpec(), ...overrides };
}

/** Perfil base con reservas de la spec: equipamiento $150.000 y emergencia $100.000. */
export function perfilConEstudio(structure: CuantoCobroStudioStructure): CuantoCobroProfileInput {
  return createBaseCompleteProfile({
    equipmentRenewalMonthly: "150000",
    emergencyFundMonthly: "100000",
    studioStructure: structure,
  });
}

/** El ejemplo de la spec (§6.3): Sabi en relación de dependencia, Cami monotributista, 10 % de ganancia. */
export const SPEC = estudio({
  ownerDrawMonthly: "2000000",
  otherLinesMonthlyContribution: "200000",
  desiredProfitMode: "percent",
  desiredProfitPercent: "10",
  people: [
    createStudioOwner({ name: "Daniel", workdaysPerWeek: "6", hoursPerWorkday: "8", vacationWeeksPerYear: "3", billablePercent: "60" }),
    createStudioPerson({
      id: "sp-sabi",
      name: "Sabi",
      employmentType: "employee",
      monthlySalary: "900000",
      socialChargesPercent: "27",
      includeSac: true,
      workdaysPerWeek: "5",
      hoursPerWorkday: "6",
      vacationWeeksPerYear: "2",
      billablePercent: "70",
      monthlySupplies: "30000",
    }),
    createStudioPerson({
      id: "sp-cami",
      name: "Cami",
      employmentType: "monotributista",
      monthlySalary: "900000",
      workdaysPerWeek: "4",
      hoursPerWorkday: "8",
      vacationWeeksPerYear: "2",
      billablePercent: "75",
      monthlySupplies: "20000",
    }),
  ],
});

/** Los números reales de Daniel (16/10): informales con aguinaldo y vacaciones, 5 días + sábados alternados. */
export const DANIEL = estudio({
  ownerDrawMonthly: "1000000",
  desiredProfitMode: "amount",
  desiredProfitMonthly: "500000",
  people: [
    createStudioOwner({ name: "Daniel", workdaysPerWeek: "6", hoursPerWorkday: "8", vacationWeeksPerYear: "2", billablePercent: "60" }),
    ...["Sabi", "Cami"].map((name) =>
      createStudioPerson({
        id: `sp-${name.toLowerCase()}`,
        name,
        employmentType: "informal",
        monthlySalary: "900000",
        includeSac: true,
        paidVacations: true,
        workdaysPerWeek: "5,5",
        hoursPerWorkday: "8",
        vacationWeeksPerYear: "2",
        billablePercent: "70",
      }),
    ),
  ],
});

