import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "../calculate-cuanto-cobro";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
  createLongJobQuote,
  createMultiConceptQuote,
  withConfiguredCamera,
} from "../__fixtures__/characterization-fixtures";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS } from "./types";

function completo(r: ReturnType<typeof calculateCuantoCobro>) {
  if (r.status !== "complete") throw new Error("se esperaba un cálculo completo");
  return r;
}

const CASOS = [
  ["base", createBaseCompleteProfile(), createBaseCompleteQuote()],
  ["largo", createBaseCompleteProfile(), createLongJobQuote()],
  ["varios conceptos", createBaseCompleteProfile(), createMultiConceptQuote()],
  ["con cámara", withConfiguredCamera(createBaseCompleteProfile()), createBaseCompleteQuote()],
] as const;

describe("compatibilidad: sin precio completo, el motor da exactamente lo mismo", () => {
  for (const [nombre, perfil, trabajo] of CASOS) {
    it(`${nombre}: sin pricingExtras no hay priceBuildUp`, () => {
      expect("priceBuildUp" in completo(calculateCuantoCobro(perfil, trabajo))).toBe(false);
    });
    it(`${nombre}: con pricingExtras vacío, resultado idéntico`, () => {
      const antes = calculateCuantoCobro(perfil, trabajo);
      const despues = calculateCuantoCobro({ ...perfil, pricingExtras: { ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS } }, trabajo);
      expect(despues).toEqual(antes);
      expect("priceBuildUp" in completo(despues)).toBe(false);
    });
  }
});

describe("precio completo dentro del motor", () => {
  it("el monotributo y el seguro anual suben el valor hora (son costo fijo)", () => {
    const perfil = createBaseCompleteProfile();
    const trabajo = createBaseCompleteQuote();
    const antes = completo(calculateCuantoCobro(perfil, trabajo));
    const despues = completo(
      calculateCuantoCobro({ ...perfil, pricingExtras: { ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS, monotributoMonthly: "60000", equipmentInsuranceAnnual: "240000" } }, trabajo),
    );
    expect(despues.monthlyNeed).toBe(antes.monthlyNeed + 80_000);
    expect(despues.hourlyRate).toBeGreaterThan(antes.hourlyRate);
  });

  it("con IIBB y comisión aparece el desglose y parte del precio del motor", () => {
    const perfil = { ...createBaseCompleteProfile(), pricingExtras: { ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS, grossIncomePercent: "3", paymentCommissionPercent: "6", depositPercent: "30" } };
    const r = completo(calculateCuantoCobro(perfil, createBaseCompleteQuote()));
    expect(r.priceBuildUp).toBeDefined();
    expect(r.priceBuildUp!.basePrice).toBe(Math.round(r.chosenPriceEffective));
    expect(r.priceBuildUp!.priceWithoutVat).toBeGreaterThan(r.chosenPriceEffective);
    expect(r.priceBuildUp!.deposit?.percent).toBe(30);
    // Los campos de siempre no cambian por el desglose.
    const sin = completo(calculateCuantoCobro(createBaseCompleteProfile(), createBaseCompleteQuote()));
    expect(r.chosenPriceEffective).toBe(sin.chosenPriceEffective);
  });

  it("un trabajo con ajustes (aunque el perfil no tenga extras) trae desglose: los recargos de un perfil vacío son 0", () => {
    const trabajo = { ...createBaseCompleteQuote(), jobAdjustments: { eventDate: "2026-10-18" } };
    const r = completo(calculateCuantoCobro(createBaseCompleteProfile(), trabajo));
    expect(r.priceBuildUp?.day?.dayType).toBe("sunday");
    expect(r.priceBuildUp?.surchargeAmount).toBe(0);
  });

  it("varios conceptos: el recargo de domingo sólo cae sobre la parte de servicios propios", () => {
    const perfil = { ...createBaseCompleteProfile(), pricingExtras: { ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS, sundaySurchargePercent: "20" } };
    const trabajo = { ...createMultiConceptQuote(), jobAdjustments: { eventDate: "2026-10-18" } };
    const r = completo(calculateCuantoCobro(perfil, trabajo));
    const b = r.priceBuildUp!;
    expect(b.ownServiceShare).toBeGreaterThan(0);
    expect(b.ownServiceShare).toBeLessThan(1);
    expect(Math.abs(b.surchargeAmount - b.basePrice * b.ownServiceShare * 0.2)).toBeLessThanOrEqual(2);
  });
});
