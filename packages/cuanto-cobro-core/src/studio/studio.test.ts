import { describe, expect, it } from "vitest";
import { calculateCuantoCobro, getCuantoCobroMissingFields, getProfileResultSteps } from "../calculate-cuanto-cobro";
import { getProfileCostHour, getProfileMonthlyNeed, getQuoteLaborRates } from "../hourly-rates";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
  createLongJobQuote,
  createMultiConceptQuote,
  withConfiguredCamera,
} from "../__fixtures__/characterization-fixtures";
import { INITIAL_CUANTO_COBRO_QUOTE, type CuantoCobroProfileInput } from "../types";
import { computeStudioBreakdown } from "./capacity";
import { isStudioModeActive, normalizeStudioStructure, parseStudioDecimal } from "./normalize";
import {
  createDefaultStudioFixedCostGroups,
  createStudioOwner,
  createStudioPerson,
  INITIAL_STUDIO_STRUCTURE,
  type CuantoCobroStudioStructure,
  type StudioFixedCostGroup,
} from "./types";

function completo(r: ReturnType<typeof calculateCuantoCobro>) {
  if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
  return r;
}

/** Gastos fijos de la spec (§4.1): $980.000. */
function fijosSpec(): StudioFixedCostGroup[] {
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

function estudio(overrides: Partial<CuantoCobroStudioStructure> = {}): CuantoCobroStudioStructure {
  return { ...INITIAL_STUDIO_STRUCTURE, enabled: true, fixedCostGroups: fijosSpec(), ...overrides };
}

/** Perfil base con reservas de la spec: equipamiento $150.000 y emergencia $100.000. */
function perfilConEstudio(structure: CuantoCobroStudioStructure): CuantoCobroProfileInput {
  return createBaseCompleteProfile({
    equipmentRenewalMonthly: "150000",
    emergencyFundMonthly: "100000",
    studioStructure: structure,
  });
}

/** El ejemplo de la spec (§6.3): Sabi en relación de dependencia, Cami monotributista, 10 % de ganancia. */
const SPEC = estudio({
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
const DANIEL = estudio({
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

describe("Mi estudio: el ejemplo de la spec (§6.3)", () => {
  const b = computeStudioBreakdown(perfilConEstudio(SPEC))!;

  it("necesidad, capacidad y valor hora del estudio", () => {
    expect(b.fixedCosts).toBe(980_000);
    expect(b.teamCost).toBeCloseTo(2_188_250, 2);
    expect(b.reserves).toBe(250_000);
    expect(b.ownerDraw).toBe(2_000_000);
    expect(b.profit).toBeCloseTo(521_825, 2);
    expect(b.monthlyNeed).toBeCloseTo(5_740_075, 2);
    expect(b.capacityHours).toBeCloseTo(304.87, 1);
    expect(b.studioHourRate!).toBeCloseTo(18_828.23, 0);
    expect(b.overheadPerHour!).toBeCloseTo(5_090.2, 0);
  });

  it("tarifa de cada persona", () => {
    const tarifa = (id: string) => b.people.find((p) => p.id === id)!.rate!;
    expect(tarifa("owner")).toBeCloseTo(22_110.09, 0);
    expect(tarifa("sp-sabi")).toBeCloseTo(19_595.64, 0);
    expect(tarifa("sp-cami")).toBeCloseTo(14_297.28, 0);
  });

  it("el promedio de las tarifas, pesado por horas, es el valor hora del estudio", () => {
    const recuperado = b.people.reduce((t, p) => t + (p.rate ?? 0) * p.billableHours, 0);
    expect(recuperado).toBeCloseTo(b.monthlyNeed, 4);
  });

  it("el valor hora del motor es el del estudio", () => {
    const perfil = perfilConEstudio(SPEC);
    expect(getProfileMonthlyNeed(perfil)).toBeCloseTo(5_740_075, 2);
    expect(getProfileCostHour(perfil)!).toBeCloseTo(b.studioHourRate!, 6);
    expect(getQuoteLaborRates(perfil)!.coverage).toBeCloseTo(b.studioHourRate!, 6);
  });
});

describe("Mi estudio: los números de Daniel", () => {
  const b = computeStudioBreakdown(perfilConEstudio(DANIEL))!;
  const sabi = b.people.find((p) => p.id === "sp-sabi")!;

  it("informal: aguinaldo sí, cargas 0, vacaciones pagas (no bajan el costo)", () => {
    expect(sabi.monthlyCost).toBeCloseTo(975_000, 2);
  });

  it("5 días + sábados alternados = 5,5 días", () => {
    expect(sabi.monthlyHours).toBeCloseTo(5.5 * 8 * 4.33 * (50 / 52), 6);
    expect(sabi.billableHours).toBeCloseTo(sabi.monthlyHours * 0.7, 6);
  });

  it("ganancia del estudio como monto fijo", () => {
    expect(b.profit).toBe(500_000);
    expect(b.monthlyNeed).toBeCloseTo(980_000 + 1_950_000 + 250_000 + 1_000_000 + 500_000, 2);
  });

  it("con monotributo en «Impuestos», se suma una sola vez", () => {
    const perfil = perfilConEstudio(DANIEL);
    perfil.pricingExtras = { ...(perfil.pricingExtras ?? {}), monotributoMonthly: "100000" } as CuantoCobroProfileInput["pricingExtras"];
    expect(computeStudioBreakdown(perfil)!.monthlyNeed).toBeCloseTo(b.monthlyNeed + 100_000, 2);
  });
});

describe("Mi estudio: tipos de contratación y casos borde", () => {
  const base = (people: CuantoCobroStudioStructure["people"]) =>
    computeStudioBreakdown(perfilConEstudio(estudio({ ownerDrawMonthly: "1000000", people })))!;
  const owner = createStudioOwner({ workdaysPerWeek: "5", hoursPerWorkday: "8" });

  it("relación de dependencia sin aguinaldo y con vacaciones no pagas", () => {
    const p = createStudioPerson({ id: "x", employmentType: "employee", monthlySalary: "1000000", socialChargesPercent: "25", includeSac: false, paidVacations: false, vacationWeeksPerYear: "4", workdaysPerWeek: "5", hoursPerWorkday: "8" });
    expect(base([owner, p]).people[1]!.monthlyCost).toBeCloseTo(1_000_000 * 1.25 * (48 / 52), 4);
  });

  it("jornal: jornal × días × 4,33", () => {
    const p = createStudioPerson({ id: "x", employmentType: "daily", dailyRate: "40000", workdaysPerWeek: "3", hoursPerWorkday: "8" });
    expect(base([owner, p]).people[1]!.monthlyCost).toBeCloseTo(40_000 * 3 * 4.33, 4);
  });

  it("por trabajo e inactivas no suman ni costo ni horas", () => {
    const porTrabajo = createStudioPerson({ id: "pt", employmentType: "per-job", perJobRate: "50000", workdaysPerWeek: "5", hoursPerWorkday: "8" });
    const inactiva = createStudioPerson({ id: "in", employmentType: "monotributista", monthlySalary: "800000", workdaysPerWeek: "5", hoursPerWorkday: "8", active: false });
    const solo = base([owner]);
    const con = base([owner, porTrabajo, inactiva]);
    expect(con.monthlyNeed).toBe(solo.monthlyNeed);
    expect(con.capacityHours).toBe(solo.capacityHours);
    expect(con.people[1]!.inStructure).toBe(false);
  });

  it("alguien con 0 % vendible: su costo va a la estructura y las cuentas siguen cerrando", () => {
    const recepcion = createStudioPerson({ id: "r", employmentType: "monotributista", monthlySalary: "600000", workdaysPerWeek: "5", hoursPerWorkday: "8", billablePercent: "0" });
    const b = base([owner, recepcion]);
    expect(b.people[1]!.rate).toBeNull();
    const recuperado = b.people.reduce((t, p) => t + (p.rate ?? 0) * p.billableHours, 0);
    expect(recuperado).toBeCloseTo(b.monthlyNeed, 4);
  });

  it("vendible vacío = 70 %", () => {
    const b = base([owner]);
    expect(b.capacityHours).toBeCloseTo(5 * 8 * 4.33 * 0.7, 6);
  });

  it("avisa cargas sociales vacías y contratación sin elegir", () => {
    const sinCargas = createStudioPerson({ id: "a", name: "Ana", employmentType: "employee", monthlySalary: "900000", workdaysPerWeek: "5", hoursPerWorkday: "8" });
    const sinTipo = createStudioPerson({ id: "b", name: "Bea" });
    const w = base([owner, sinCargas, sinTipo]).warnings.join(" | ");
    expect(w).toContain("Ana: faltan las cargas sociales");
    expect(w).toContain("Bea: falta elegir cómo está contratada");
  });
});

describe("Mi estudio: validación por modo", () => {
  it("con el modo, los pasos son los del estudio", () => {
    expect(getProfileResultSteps(perfilConEstudio(DANIEL))).toContain("studio-team");
    expect(getProfileResultSteps(createBaseCompleteProfile())).toContain("personal");
  });

  it("faltan retiro, jornada del dueño y datos de cada persona", () => {
    const perfil = perfilConEstudio(estudio({ people: [createStudioOwner(), createStudioPerson({ id: "x", name: "Sabi" })] }));
    expect(getCuantoCobroMissingFields("studio-owner", perfil, INITIAL_CUANTO_COBRO_QUOTE)).toEqual([
      "Tu retiro por mes",
      "Tus días de trabajo por semana",
      "Tus horas por día",
    ]);
    expect(getCuantoCobroMissingFields("studio-team", perfil, INITIAL_CUANTO_COBRO_QUOTE)).toEqual(["Cómo está contratada Sabi"]);
    expect(calculateCuantoCobro(perfil, createBaseCompleteQuote()).status).toBe("incomplete");
  });

  it("en modo estudio no hacen falta gastos personales ni distribución del tiempo", () => {
    const perfil = { ...perfilConEstudio(DANIEL), weeklyHours: "", personalExpenseGroups: [] };
    const r = completo(calculateCuantoCobro(perfil, createBaseCompleteQuote()));
    expect(r.studio?.monthlyNeed).toBeCloseTo(4_680_000, 2);
    expect(r.hourlyRate).toBeCloseTo(r.studio!.studioHourRate!, 6);
    expect(r.personalExpenses).toBe(1_000_000);
    expect(r.businessExpenses).toBe(980_000);
    expect(r.monthlyBillableHours).toBeCloseTo(r.studio!.capacityHours, 6);
  });
});

describe("Mi estudio: compatibilidad", () => {
  const casos = [
    ["base", createBaseCompleteProfile(), createBaseCompleteQuote()],
    ["largo", createBaseCompleteProfile(), createLongJobQuote()],
    ["varios conceptos", createBaseCompleteProfile(), createMultiConceptQuote()],
    ["con cámara", withConfiguredCamera(createBaseCompleteProfile()), createBaseCompleteQuote()],
  ] as const;

  for (const [nombre, perfil, trabajo] of casos) {
    it(`${nombre}: sin bloque no hay clave studio`, () => {
      expect("studio" in completo(calculateCuantoCobro(perfil, trabajo))).toBe(false);
    });
    it(`${nombre}: con el bloque apagado, resultado idéntico`, () => {
      const antes = calculateCuantoCobro(perfil, trabajo);
      const apagado = calculateCuantoCobro({ ...perfil, studioStructure: { ...DANIEL, enabled: false } }, trabajo);
      expect(apagado).toEqual(antes);
    });
  }

  it("apagar el modo vuelve al cálculo de siempre (los campos viejos no se tocan)", () => {
    const solo = createBaseCompleteProfile();
    const encendido = { ...solo, studioStructure: DANIEL };
    expect(getProfileCostHour(encendido)).not.toBe(getProfileCostHour(solo));
    expect(getProfileCostHour({ ...encendido, studioStructure: { ...DANIEL, enabled: false } })).toBe(getProfileCostHour(solo));
  });
});

describe("Mi estudio: normalización", () => {
  it("basura → null; vacío → inicial apagado con un dueño", () => {
    expect(normalizeStudioStructure("x")).toBeNull();
    const n = normalizeStudioStructure({})!;
    expect(n.enabled).toBe(false);
    expect(n.people.filter((p) => p.role === "owner")).toHaveLength(1);
    expect(n.desiredProfitMode).toBe("amount");
  });

  it("un solo dueño, sin ids repetidos ni tipos inventados", () => {
    const n = normalizeStudioStructure({
      enabled: true,
      people: [
        { id: "a", role: "owner", name: "Uno", employmentType: "employee" },
        { id: "a", role: "staff", name: "Repetido" },
        { id: "b", role: "owner", name: "Dos", employmentType: "inventado", skills: ["photo", "x", "photo"] },
        { name: "sin id" },
      ],
    })!;
    expect(n.people.map((p) => [p.id, p.role, p.employmentType])).toEqual([
      ["a", "owner", ""],
      ["b", "staff", ""],
    ]);
    expect(n.people[1]!.skills).toEqual(["photo"]);
  });

  it("el vínculo con un miembro sólo si es un id de usuario válido", () => {
    const n = normalizeStudioStructure({ people: [{ id: "a", link: { kind: "member", userId: 12 } }, { id: "b", link: { kind: "member", userId: "12" } }] })!;
    expect(n.people.find((p) => p.id === "a")!.link).toEqual({ kind: "member", userId: 12 });
    expect(n.people.find((p) => p.id === "b")!.link).toBeUndefined();
  });

  it("isStudioModeActive sólo con enabled: true", () => {
    expect(isStudioModeActive({ studioStructure: undefined })).toBe(false);
    expect(isStudioModeActive({ studioStructure: { ...DANIEL, enabled: false } })).toBe(false);
    expect(isStudioModeActive({ studioStructure: DANIEL })).toBe(true);
  });

  it("parseStudioDecimal acepta coma y punto", () => {
    expect(parseStudioDecimal("5,5")).toBe(5.5);
    expect(parseStudioDecimal("5.5")).toBe(5.5);
    expect(parseStudioDecimal("8")).toBe(8);
    expect(parseStudioDecimal("")).toBeNull();
    expect(parseStudioDecimal("abc")).toBeNull();
  });
});
