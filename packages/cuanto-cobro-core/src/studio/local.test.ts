import { describe, expect, it } from "vitest";
import { calculateCuantoCobro, getCuantoCobroMissingFields, getProfileResultSteps } from "../calculate-cuanto-cobro";
import { createBaseCompleteQuote, createOwnServiceConcept } from "../__fixtures__/characterization-fixtures";
import { perfilDanielSeparado } from "../__fixtures__/studio-fixtures";
import { createDefaultPersonalExpenseGroups } from "../default-expense-groups";
import { INITIAL_CUANTO_COBRO_QUOTE } from "../types";
import type { CuantoCobroProfileInput } from "../types";
import { computeStudioBreakdown, getStudioMissingFields } from "./capacity";
import {
  effectiveCoverageSharePercent,
  isSeparateLocalActive,
  normalizeStudioStructure,
} from "./normalize";
import {
  createStudioOwner,
  createStudioPerson,
  defaultFixedCostScope,
  fixedCostScope,
  INITIAL_STUDIO_STRUCTURE,
  personScope,
  type CuantoCobroStudioStructure,
} from "./types";

describe("Mi estudio: modo local y coberturas (tipos y normalización)", () => {
  it("conserva separateLocal, los cinco campos de texto y los scope válidos", () => {
    const largo = "1".repeat(30);
    const n = normalizeStudioStructure({
      enabled: true,
      separateLocal: true,
      coverageSharePercent: largo,
      ownerLocalTimePercent: "20",
      ownerLocalSalaryMonthly: "500000",
      localGoodsCostPercent: "40",
      localMonthlyContributionManual: "100000",
      fixedCostGroups: [
        { id: "g", title: "G", items: [{ id: "a", label: "A", amount: "1", scope: "coverage" }, { id: "b", label: "B", amount: "1", scope: "otro" }] },
      ],
      people: [
        { id: "owner", role: "owner", scope: "local" },
        { id: "p1", role: "staff", scope: "coverage" },
        { id: "p2", role: "staff", scope: "shared" },
      ],
    })!;
    expect(n.separateLocal).toBe(true);
    expect(n.coverageSharePercent).toBe(largo.slice(0, 20));
    expect(n.ownerLocalTimePercent).toBe("20");
    expect(n.ownerLocalSalaryMonthly).toBe("500000");
    expect(n.localGoodsCostPercent).toBe("40");
    expect(n.localMonthlyContributionManual).toBe("100000");
    const items = n.fixedCostGroups[0].items;
    expect(items[0].scope).toBe("coverage");
    expect("scope" in items[1]).toBe(false);
    const p = Object.fromEntries(n.people.map((x) => [x.id, x]));
    expect(p.p1.scope).toBe("coverage");
    expect("scope" in p.p2).toBe(false);
  });

  it("sin los campos nuevos no agrega ninguno", () => {
    const n = normalizeStudioStructure({ enabled: true })!;
    for (const k of ["separateLocal", "coverageSharePercent", "ownerLocalTimePercent", "ownerLocalSalaryMonthly", "localGoodsCostPercent", "localMonthlyContributionManual"]) {
      expect(k in n).toBe(false);
    }
    expect(n.people.every((x) => !("scope" in x))).toBe(true);
    expect(n).toEqual(normalizeStudioStructure(n));
  });

  it("scope por omisión de los rubros", () => {
    expect(defaultFixedCostScope("premises")).toBe("local");
    expect(defaultFixedCostScope("utilities")).toBe("local");
    expect(defaultFixedCostScope("software")).toBe("shared");
    expect(defaultFixedCostScope("marketing")).toBe("shared");
    expect(defaultFixedCostScope("admin")).toBe("shared");
    expect(defaultFixedCostScope("desconocido")).toBe("local");
    expect(fixedCostScope("software", { id: "x", label: "", amount: "", isCustom: false })).toBe("shared");
    expect(fixedCostScope("software", { id: "x", label: "", amount: "", isCustom: false, scope: "coverage" })).toBe("coverage");
  });

  it("personScope: el dueño siempre es de coberturas", () => {
    expect(personScope(createStudioOwner({ scope: "local" }))).toBe("coverage");
    expect(personScope(createStudioPerson())).toBe("local");
    expect(personScope(createStudioPerson({ scope: "coverage" }))).toBe("coverage");
  });

  it("effectiveCoverageSharePercent", () => {
    expect(effectiveCoverageSharePercent({ ownerLocalTimePercent: "20" } as CuantoCobroStudioStructure)).toBe(80);
    expect(effectiveCoverageSharePercent({ coverageSharePercent: "70", ownerLocalTimePercent: "20" } as CuantoCobroStudioStructure)).toBe(70);
    expect(effectiveCoverageSharePercent({} as CuantoCobroStudioStructure)).toBe(100);
  });

  it("effectiveCoverageSharePercent queda entre 0 y 100", () => {
    expect(effectiveCoverageSharePercent({ coverageSharePercent: "150" } as CuantoCobroStudioStructure)).toBe(100);
    expect(effectiveCoverageSharePercent({ ownerLocalTimePercent: "130" } as CuantoCobroStudioStructure)).toBe(0);
  });

  it("isSeparateLocalActive exige modo estudio y separateLocal", () => {
    const base = { ...INITIAL_STUDIO_STRUCTURE, enabled: true };
    expect(isSeparateLocalActive({ studioStructure: { ...base, separateLocal: true } })).toBe(true);
    expect(isSeparateLocalActive({ studioStructure: base })).toBe(false);
    expect(isSeparateLocalActive({ studioStructure: { ...base, enabled: false, separateLocal: true } })).toBe(false);
    expect(isSeparateLocalActive({ studioStructure: undefined })).toBe(false);
  });
});

/** El perfil de Daniel con cambios en el bloque «Mi estudio». */
function conEstudio(cambios: Partial<CuantoCobroStudioStructure>, perfil = perfilDanielSeparado()): CuantoCobroProfileInput {
  return { ...perfil, studioStructure: { ...perfil.studioStructure!, ...cambios } };
}

const tarifaDueño = (p: CuantoCobroProfileInput) => computeStudioBreakdown(p)!.people.find((x) => x.id === "owner")!.rate!;

describe("Local y coberturas: los números de Daniel", () => {
  const b = computeStudioBreakdown(perfilDanielSeparado())!;

  it("la necesidad que pagan los eventos es $2.163.667", () => {
    expect(Math.abs(b.monthlyNeed - 2_163_667)).toBeLessThanOrEqual(1);
    expect(b.separated!.sharedToCoverage).toBe(104_000);
    expect(b.separated!.coverageFixed).toBe(0);
    expect(b.separated!.ownerNetNeed).toBe(1_968_000);
    expect(b.separated!.personalNeed).toBe(3_168_000);
    expect(b.separated!.localSalary).toBe(1_000_000);
    expect(b.separated!.externalIncome).toBe(200_000);
    expect(b.separated!.sharedFixed).toBe(130_000);
    expect(b.separated!.coverageTeamCost).toBe(0);
    expect(b.ownerDraw).toBe(1_968_000);
    expect(b.fixedCosts).toBe(104_000);
    expect(b.teamCost).toBe(0);
    expect(b.otherLinesContribution).toBe(0);
  });

  it("la hora de Daniel es $20.821", () => {
    expect(Math.abs(tarifaDueño(perfilDanielSeparado()) - 20_821)).toBeLessThanOrEqual(1);
  });

  it("Camila cobra a su costo, sin estructura, y no suma horas a las coberturas", () => {
    const camila = b.people.find((p) => p.id === "sp-camila")!;
    expect(camila.billableHours).toBeGreaterThan(0);
    expect(camila.rate).toBeCloseTo(975_000 / camila.billableHours, 4);
    expect(camila.rate).toBe(camila.costPerHour);
    const dueño = b.people.find((p) => p.id === "owner")!;
    expect(b.capacityHours).toBeCloseTo(dueño.billableHours, 6);
    expect(b.capacityHours).toBeCloseTo(103.9, 1);
  });

  it("propiedad: Σ tarifa × horas de quienes suman capacidad = necesidad", () => {
    const conCapacidad = b.people.filter((p) => p.id === "owner" || p.id === "sp-cobertura");
    const total = conCapacidad.reduce((t, p) => t + p.rate! * p.billableHours, 0);
    expect(Math.abs(total - b.monthlyNeed)).toBeLessThanOrEqual(1);
  });

  it("propiedad con una persona de coberturas", () => {
    const perfil = perfilDanielSeparado();
    const estudio = perfil.studioStructure!;
    const p = conEstudio({
      people: [...estudio.people, { ...estudio.people[1]!, id: "sp-cobertura", name: "Asistente", scope: "coverage" }],
    });
    const bb = computeStudioBreakdown(p)!;
    expect(bb.separated!.coverageTeamCost).toBeCloseTo(975_000, 4);
    const conCapacidad = bb.people.filter((x) => x.id === "owner" || x.id === "sp-cobertura");
    expect(bb.capacityHours).toBeCloseTo(conCapacidad.reduce((t, x) => t + x.billableHours, 0), 6);
    const total = conCapacidad.reduce((t, x) => t + x.rate! * x.billableHours, 0);
    expect(Math.abs(total - bb.monthlyNeed)).toBeLessThanOrEqual(1);
  });

  it("el alquiler y los sueldos del local no cambian la tarifa del dueño", () => {
    const base = tarifaDueño(perfilDanielSeparado());
    const perfil = perfilDanielSeparado();
    const estudio = perfil.studioStructure!;
    const alquilerAlto = conEstudio({
      fixedCostGroups: estudio.fixedCostGroups.map((g) => ({
        ...g,
        items: g.items.map((i) => (i.id === "rent" ? { ...i, amount: "900000" } : i)),
      })),
    });
    const sueldoAlto = conEstudio({
      people: estudio.people.map((x) => (x.id === "sp-camila" ? { ...x, monthlySalary: "2000000" } : x)),
    });
    expect(tarifaDueño(alquilerAlto)).toBeCloseTo(base, 6);
    expect(tarifaDueño(sueldoAlto)).toBeCloseTo(base, 6);
  });

  it("con separateLocal apagado da exactamente lo de antes", () => {
    const off = computeStudioBreakdown(conEstudio({ separateLocal: false }))!;
    // Foto tomada con el motor antes del modo separado.
    expect(off.fixedCosts).toBe(965_000);
    expect(off.teamCost).toBeCloseTo(1_950_000, 4);
    expect(off.reserves).toBe(91_667);
    expect(off.fixedFromExtras).toBe(0);
    expect(off.ownerDraw).toBe(1_000_000);
    expect(off.otherLinesContribution).toBe(0);
    expect(off.profit).toBe(0);
    expect(off.monthlyNeed).toBeCloseTo(4_006_667, 4);
    expect(off.capacityHours).toBeCloseTo(255.47, 6);
    expect(off.totalMonthlyHours).toBeCloseTo(424.34, 6);
    expect(off.studioHourRate).toBeCloseTo(15_683.512741222063, 6);
    expect(off.overheadPerHour).toBeCloseTo(4_136.168630367559, 6);
    expect(off.people.map((p) => [p.id, p.billableHours, p.monthlyCost, p.rate])).toEqual([
      ["owner", expect.closeTo(103.92, 6), 1_000_000, expect.closeTo(13_758.955389412979, 6)],
      ["sp-camila", expect.closeTo(75.775, 6), expect.closeTo(975_000, 4), expect.closeTo(17_003.209211034005, 6)],
      ["sp-sabina", expect.closeTo(75.775, 6), expect.closeTo(975_000, 4), expect.closeTo(17_003.209211034005, 6)],
    ]);
    expect(off.warnings).toEqual([]);
    expect("separated" in off).toBe(false);
    expect(getProfileResultSteps(conEstudio({ separateLocal: false }))).not.toContain("studio-local");
  });

  it("sin gastos personales falta un dato y no calcula", () => {
    const p = { ...perfilDanielSeparado(), personalExpenseGroups: createDefaultPersonalExpenseGroups() };
    expect(getProfileResultSteps(p)).toContain("studio-local");
    expect(getStudioMissingFields("studio-local", p)).toContain("Tus gastos personales");
    expect(getCuantoCobroMissingFields("studio-local", p, INITIAL_CUANTO_COBRO_QUOTE)).toContain("Tus gastos personales");
    expect(calculateCuantoCobro(p, createBaseCompleteQuote()).status).toBe("incomplete");
  });

  it("lo que te paga el local: vacío falta, 0 vale", () => {
    expect(getStudioMissingFields("studio-local", conEstudio({ ownerLocalSalaryMonthly: "" }))).toEqual(["Lo que te paga el local"]);
    expect(getStudioMissingFields("studio-local", conEstudio({ ownerLocalSalaryMonthly: "0" }))).toEqual([]);
    expect(getStudioMissingFields("studio-local", perfilDanielSeparado())).toEqual([]);
    expect(getStudioMissingFields("studio-local", conEstudio({ separateLocal: false, ownerLocalSalaryMonthly: "" }))).toEqual([]);
  });

  it("si el sueldo del local cubre los gastos personales, avisa", () => {
    const bb = computeStudioBreakdown(conEstudio({ ownerLocalSalaryMonthly: "5000000" }))!;
    expect(bb.separated!.ownerNetNeed).toBe(0);
    expect(bb.warnings).toContain("Lo que te paga el local cubre todos tus gastos personales: revisá esos montos.");
  });

  it("parte cobrable mayor que el tiempo fuera del local: avisa y calcula igual", () => {
    const perfil = perfilDanielSeparado();
    const p = conEstudio({
      people: perfil.studioStructure!.people.map((x) => (x.id === "owner" ? { ...x, billablePercent: "90" } : x)),
    });
    const bb = computeStudioBreakdown(p)!;
    expect(bb.warnings).toContain("Tu parte cobrable no puede ser mayor que el tiempo que no le das al local.");
    expect(bb.capacityHours).toBeGreaterThan(0);
    expect(calculateCuantoCobro(p, createBaseCompleteQuote()).status).toBe("complete");
    expect(b.warnings).not.toContain("Tu parte cobrable no puede ser mayor que el tiempo que no le das al local.");
  });

  it("una persona del local asignada a una cobertura se cobra a su costo por hora", () => {
    const quote = createBaseCompleteQuote({
      concepts: [
        createOwnServiceConcept({
          coverageHours: "3",
          editingHours: "0",
          travelHours: "0",
          deliveryHours: "0",
          directCost: "0",
          estimatedShots: "",
          assignments: [{ personId: "sp-camila", activity: "coverage", hours: "3" }],
        }),
      ],
    });
    const r = calculateCuantoCobro(perfilDanielSeparado(), quote);
    if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
    const camila = b.people.find((p) => p.id === "sp-camila")!;
    const labor = r.quoteSummary.laborByPerson!.find((l) => l.personId === "sp-camila")!;
    expect(labor.atStudioRate).toBe(false);
    expect(labor.cost).toBeCloseTo(3 * camila.costPerHour!, 4);
  });
});

describe("Mi estudio: precio de punta a punta con local separado", () => {
  const as = (activity: "coverage" | "editing" | "travel" | "delivery", hours: string) => ({ personId: "owner", activity, hours });
  /** Sin horas de cliente (reuniones, cobranza…): el total sale sólo del concepto. */
  const SIN_CLIENTE = { salesHours: "0", meetingsHours: "0", generalPrepHours: "0", coordinationHours: "0", billingHours: "0", followUpHours: "0", administrativeDeliveryHours: "0" };
  function sesionPreXv(conTravelYDelivery = true) {
    return createBaseCompleteQuote({
      client: { ...createBaseCompleteQuote().client, hours: SIN_CLIENTE },
      concepts: [
        createOwnServiceConcept({
          name: "Sesión PRE XV con maquillaje y fiesta completa",
          coverageHours: "11",
          editingHours: "11",
          salesHours: "2",
          travelHours: "1",
          deliveryHours: "1",
          directCost: "50000",
          desiredMarginPercent: "",
          assignments: [as("coverage", "11"), as("editing", "11"), ...(conTravelYDelivery ? [as("travel", "1"), as("delivery", "1")] : [])],
        }),
      ],
    });
  }
  function calcular(perfil: CuantoCobroProfileInput, quote = sesionPreXv()) {
    const r = calculateCuantoCobro(perfil, quote);
    if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
    return r;
  }
  const precio = (r: ReturnType<typeof calcular>) => r.priceBuildUp?.priceWithoutVat ?? r.chosenPriceEffective;

  it("26 h, valor hora del dueño ≈ 20821 y precio ≈ 650466", () => {
    const r = calcular(perfilDanielSeparado());
    expect(r.totalJobHours).toBe(26);
    expect(r.hourlyRate).toBeCloseTo(20_821, -1);
    expect(Math.abs(precio(r) - 650_466)).toBeLessThanOrEqual(2);
  });

  it("con posicionamiento «established» ≈ 887000", () => {
    const r = calcular({ ...perfilDanielSeparado(), commercialPositioningId: "established" });
    expect(r.totalJobHours).toBe(26);
    expect(Math.abs(precio(r) - 887_000)).toBeLessThanOrEqual(2);
  });

  it("no cuenta doble: sin asignar viaje y entrega también son 26 h", () => {
    expect(calcular(perfilDanielSeparado(), sesionPreXv(false)).totalJobHours).toBe(26);
    expect(calcular({ ...perfilDanielSeparado(), commercialPositioningId: "established" }, sesionPreXv(false)).totalJobHours).toBe(26);
  });
});
