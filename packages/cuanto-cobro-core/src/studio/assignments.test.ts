/**
 * Quién hace qué (E3, spec §7): lo asignado a una persona va a su tarifa; lo que no se asigna, al valor
 * hora del estudio. Números del ejemplo de la spec (§6.3).
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "../calculate-cuanto-cobro";
import { getQuoteLaborRates } from "../hourly-rates";
import { createBaseCompleteProfile, createBaseCompleteQuote, createOwnServiceConcept } from "../__fixtures__/characterization-fixtures";
import { perfilConEstudio, SPEC } from "../__fixtures__/studio-fixtures";
import { createStudioPerson } from "./types";
import type { CuantoCobroQuoteAssignment, CuantoCobroQuoteItem } from "../types";

function completo(r: ReturnType<typeof calculateCuantoCobro>) {
  if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
  return r;
}

const PERFIL = perfilConEstudio(SPEC);
const RATES = getQuoteLaborRates(PERFIL)!;
const ESTUDIO = RATES.coverage;
const T = RATES.byPerson!;

const a = (personId: string, activity: CuantoCobroQuoteAssignment["activity"], hours: string): CuantoCobroQuoteAssignment => ({ personId, activity, hours });

/** El evento de la spec: 6 h de cobertura con dos fotógrafos, 1 h de viaje cada uno y 10 h de edición. */
function evento(assignments?: CuantoCobroQuoteAssignment[], extra: Partial<CuantoCobroQuoteItem> = {}) {
  return createBaseCompleteQuote({
    concepts: [
      createOwnServiceConcept({ coverageHours: "12", editingHours: "10", travelHours: "2", deliveryHours: "0", directCost: "0", estimatedShots: "", ...(assignments ? { assignments } : {}), ...extra }),
    ],
  });
}

const TODO_ASIGNADO = [a("owner", "coverage", "6"), a("sp-sabi", "coverage", "6"), a("owner", "travel", "1"), a("sp-sabi", "travel", "1"), a("sp-cami", "editing", "10")];

describe("tarifas por persona", () => {
  it("el motor entrega la tarifa de cada persona en modo estudio, y nada sin el modo", () => {
    expect(T.owner).toBeCloseTo(22_110.09, 0);
    expect(T["sp-sabi"]).toBeCloseTo(19_595.64, 0);
    expect(T["sp-cami"]).toBeCloseTo(14_297.28, 0);
    expect(getQuoteLaborRates(createBaseCompleteProfile())!.byPerson).toBeUndefined();
  });
});

describe("quién hace qué en un concepto", () => {
  it("sin asignar: todo al valor hora del estudio (opción A)", () => {
    const item = completo(calculateCuantoCobro(PERFIL, evento())).quoteSummary.items[0]!;
    expect(item.laborCost).toBeCloseTo(24 * ESTUDIO, 4);
    expect(item.laborByPerson).toBeUndefined();
  });

  it("todo asignado: cada hora a la tarifa de quien la hace (opción B, $434.913)", () => {
    const r = completo(calculateCuantoCobro(PERFIL, evento(TODO_ASIGNADO)));
    const item = r.quoteSummary.items[0]!;
    expect(item.laborCost).toBeCloseTo(7 * T.owner! + 7 * T["sp-sabi"]! + 10 * T["sp-cami"]!, 4);
    expect(Math.round(item.laborCost)).toBe(434_913);
    expect(item.ownHours).toBe(24);
    expect(r.quoteSummary.laborByPerson?.map((p) => [p.personId, p.hours])).toEqual([
      ["owner", 7],
      ["sp-sabi", 7],
      ["sp-cami", 10],
    ]);
  });

  it("parcial: lo que falta asignar va al valor hora del estudio", () => {
    const item = completo(calculateCuantoCobro(PERFIL, evento([a("owner", "coverage", "6")]))).quoteSummary.items[0]!;
    expect(item.laborCost).toBeCloseTo(6 * T.owner! + 6 * ESTUDIO + 12 * ESTUDIO, 4);
  });

  it("si lo asignado supera las horas del concepto, mandan las asignaciones (horas-persona)", () => {
    const item = completo(calculateCuantoCobro(PERFIL, evento([a("owner", "coverage", "6"), a("sp-sabi", "coverage", "6")], { coverageHours: "6" }))).quoteSummary.items[0]!;
    expect(item.ownHours).toBe(12 + 10 + 2);
    expect(item.laborCost).toBeCloseTo(6 * T.owner! + 6 * T["sp-sabi"]! + 12 * ESTUDIO, 4);
  });

  it("la cantidad multiplica las horas asignadas", () => {
    const item = completo(calculateCuantoCobro(PERFIL, evento([a("sp-cami", "editing", "10")], { quantity: "2" }))).quoteSummary.items[0]!;
    expect(item.laborByPerson?.[0]?.hours).toBe(20);
  });

  it("producto: las horas de diseño se pueden asignar", () => {
    const producto: CuantoCobroQuoteItem = {
      ...createOwnServiceConcept(),
      itemType: "physical-product",
      supplierCost: "10000",
      productionHours: "2",
      desiredMarginPercent: "0",
      assignments: [a("sp-cami", "production", "2")],
    };
    const item = completo(calculateCuantoCobro(PERFIL, createBaseCompleteQuote({ concepts: [producto] }))).quoteSummary.items[0]!;
    expect(item.laborCost).toBeCloseTo(2 * T["sp-cami"]!, 4);
  });
});

describe("avisos de las asignaciones", () => {
  it("sin modo estudio: se ignoran y se avisa", () => {
    const r = completo(calculateCuantoCobro(createBaseCompleteProfile(), evento(TODO_ASIGNADO)));
    expect(r.quoteSummary.items[0]!.laborByPerson).toBeUndefined();
    expect(r.warnings.join(" ")).toContain("no está en «Mi estudio»");
  });

  it("persona borrada o «por trabajo»: al valor hora del estudio y con aviso", () => {
    const perfil = perfilConEstudio({
      ...SPEC,
      people: [...SPEC.people, createStudioPerson({ id: "sp-video", name: "Leo", employmentType: "per-job", perJobRate: "80000" })],
    });
    const r = completo(calculateCuantoCobro(perfil, evento([a("sp-borrada", "coverage", "6"), a("sp-video", "coverage", "6")])));
    const studioRate = getQuoteLaborRates(perfil)!.coverage;
    expect(r.quoteSummary.items[0]!.laborCost).toBeCloseTo(24 * studioRate, 4);
    const w = r.warnings.join(" | ");
    expect(w).toContain("ya no está en el equipo");
    expect(w).toContain("Leo cobra por trabajo");
  });

  it("más horas que las que la persona puede cobrar por mes", () => {
    const r = completo(calculateCuantoCobro(PERFIL, evento([a("sp-cami", "editing", "120")], { editingHours: "120" })));
    expect(r.warnings.join(" ")).toContain("Cami puede cobrar 100 h por mes y este trabajo le asigna 120 h.");
  });
});
