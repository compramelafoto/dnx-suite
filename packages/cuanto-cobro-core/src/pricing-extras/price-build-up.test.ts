import { describe, expect, it } from "vitest";
import { buildPriceBuildUp, isPricingExtrasActive, monthsBetween, normalizePricingExtras, parsePercent, roundUpTo } from "./price-build-up";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS as BASE, type CuantoCobroPricingExtras } from "./types";

function run(extras: Partial<CuantoCobroPricingExtras>, rest: Partial<Parameters<typeof buildPriceBuildUp>[0]> = {}) {
  return buildPriceBuildUp({
    extras: { ...BASE, ...extras },
    adjustments: {},
    basePrice: 1_000_000,
    ownServiceShare: 1,
    costHour: 20_000,
    positioningFactor: 1,
    ...rest,
  });
}

describe("ayudas", () => {
  it("porcentajes con coma o punto; vacío = 0; fuera de rango = null", () => {
    expect(parsePercent("3,5")).toBe(3.5);
    expect(parsePercent("21")).toBe(21);
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("150")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
  });
  it("redondeo hacia arriba a $100", () => {
    expect(roundUpTo(1_234_501, 100)).toBe(1_234_600);
    expect(roundUpTo(1_234_500, 100)).toBe(1_234_500);
  });
  it("meses de calendario entre dos fechas", () => {
    expect(monthsBetween("2026-10-15", "2027-04-15")).toBe(6);
    expect(monthsBetween("2026-10-15", "2027-04-14")).toBe(5);
    expect(monthsBetween("2026-10-15", "2026-10-30")).toBe(0);
    expect(monthsBetween("2026-10-15", "2026-09-01")).toBe(0);
  });
  it("activo sólo con algo que cambia el precio (el monotributo va por el valor hora)", () => {
    expect(isPricingExtrasActive(undefined)).toBe(false);
    expect(isPricingExtrasActive(BASE)).toBe(false);
    expect(isPricingExtrasActive({ ...BASE, monotributoMonthly: "50000" })).toBe(false);
    expect(isPricingExtrasActive({ ...BASE, grossIncomePercent: "3,5" })).toBe(true);
    expect(isPricingExtrasActive({ ...BASE, ivaCondition: "responsable_inscripto" })).toBe(true);
  });
  it("normaliza lo que viene de un JSON viejo o incompleto", () => {
    const n = normalizePricingExtras({ grossIncomePercent: "3", travelZones: [{ id: "a", name: "A", upToKm: "10", amount: "0" }, "x"], extraHolidays: ["2026-10-07", "mal"] });
    expect(n).toMatchObject({ grossIncomePercent: "3", includeCommissionInPrice: true, travelZones: [{ id: "a" }], extraHolidays: ["2026-10-07"] });
    expect(normalizePricingExtras(null)).toBeNull();
  });
});

describe("orden de las operaciones", () => {
  it("monotributo: N ÷ (1 − IIBB − comisión), redondeado a $100 hacia arriba", () => {
    const r = run({ grossIncomePercent: "3", paymentCommissionPercent: "6" });
    // 1.000.000 / 0,91 = 1.098.901,09 → 1.099.000
    expect(r.netDesired).toBe(1_000_000);
    expect(r.priceWithoutVat).toBe(1_099_000);
    expect(r.total).toBe(1_099_000);
    expect(r.grossIncomeTax).toBe(32_970);
    expect(r.commission).toBe(65_940);
    expect(r.takeHome).toBe(1_099_000 - 32_970 - 65_940);
    expect(r.suggestedTransferDiscountPercent).toBe(6);
  });

  it("responsable inscripto: N ÷ (1 − IIBB − comisión × (1 + IVA)) y el IVA aparte", () => {
    const r = run({ ivaCondition: "responsable_inscripto", grossIncomePercent: "3", paymentCommissionPercent: "6" });
    // 1 − 0,03 − 0,06 × 1,21 = 0,8974 → 1.114.330,29 → 1.114.400
    expect(r.priceWithoutVat).toBe(1_114_400);
    expect(r.iva).toBe(234_024);
    expect(r.total).toBe(1_348_424);
    expect(r.commission).toBe(Math.round(1_348_424 * 0.06));
  });

  it("la comisión se puede apagar para un trabajo", () => {
    const r = run({ paymentCommissionPercent: "6" }, { adjustments: { includeCommission: false } });
    expect(r.commission).toBe(0);
    expect(r.priceWithoutVat).toBe(1_000_000);
    expect(r.suggestedTransferDiscountPercent).toBeNull();
  });

  it("recargos: el mayor entre sábado, domingo y feriado, más el exprés, sólo sobre los servicios propios", () => {
    const extras = { saturdaySurchargePercent: "10", sundaySurchargePercent: "15", holidaySurchargePercent: "20", expressSurchargePercent: "10" };
    // Sábado 20/6/2026 es feriado: gana el 20.
    const r = run(extras, { adjustments: { eventDate: "2026-06-20", express: true }, ownServiceShare: 0.75 });
    expect(r.day).toMatchObject({ dayType: "holiday" });
    expect(r.daySurchargePercent).toBe(20);
    expect(r.expressSurchargePercent).toBe(10);
    expect(r.surchargeAmount).toBe(225_000); // 1.000.000 × 0,75 × 30 %
    expect(r.subtotal).toBe(1_225_000);
    const domingo = run(extras, { adjustments: { eventDate: "2026-10-18" } });
    expect(domingo.daySurchargePercent).toBe(15);
    const habil = run(extras, { adjustments: { eventDate: "2026-10-14" } });
    expect(habil.surchargeAmount).toBe(0);
  });

  it("la fecha del evento sale del trabajo o, si no, del cliente", () => {
    const r = run({ sundaySurchargePercent: "15" }, { clientJobDate: "2026-10-18" });
    expect(r.daySurchargePercent).toBe(15);
  });

  it("viáticos y seguro del evento suman al costo, sin recargos ni ganancia; retoque es servicio propio", () => {
    const r = run(
      { travelMode: "per_km", travelPerKm: "300", retouchMinutesPerPhoto: "6", sundaySurchargePercent: "10" },
      { adjustments: { eventDate: "2026-10-18", distanceKm: "40", eventInsuranceCost: "15000", retouchPhotos: "50" }, positioningFactor: 1.2 },
    );
    // retoque: 50 × 6 min = 5 h × 20.000 = 100.000 de costo; precio × 1,2 = 120.000
    expect(r.retouch).toEqual({ photos: 50, hours: 5, cost: 100_000, price: 120_000 });
    expect(r.travel).toMatchObject({ km: 40, cost: 24_000 });
    expect(r.eventInsurance).toBe(15_000);
    // recargo 10 % sobre (1.000.000 + 120.000)
    expect(r.surchargeAmount).toBe(112_000);
    expect(r.subtotal).toBe(1_000_000 + 120_000 + 112_000 + 24_000 + 15_000);
    expect(r.extraCost).toBe(100_000 + 24_000 + 15_000);
  });

  it("inflación: sólo sobre el saldo (la seña no), por los meses hasta el evento", () => {
    const r = run(
      { inflationEnabled: true, inflationMonthlyPercent: "2", depositPercent: "30" },
      { adjustments: { quoteDate: "2026-10-15", eventDate: "2027-04-17" } },
    );
    // saldo 70 % de 1.000.000 × (1,02^6 − 1)
    const esperado = Math.round(700_000 * (1.02 ** 6 - 1));
    expect(r.inflation).toEqual({ months: 6, monthlyPercent: 2, amount: esperado });
    expect(r.netDesired).toBe(1_000_000 + esperado);
  });

  it("sin fecha del cálculo no hay inflación (el motor no lee el reloj), y lo avisa", () => {
    const r = run({ inflationEnabled: true, inflationMonthlyPercent: "2" }, { adjustments: { eventDate: "2027-04-17" } });
    expect(r.inflation).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/inflación/);
  });

  it("seña y saldo sobre el total", () => {
    const r = run({ depositPercent: "30" });
    expect(r.deposit).toEqual({ percent: 30, amount: 300_000 });
    expect(r.balance).toBe(700_000);
  });

  it("hora extra: valor hora × posicionamiento × recargo, con impuestos y comisión, a $100", () => {
    const r = run({ overtimeSurchargePercent: "50", paymentCommissionPercent: "6" }, { positioningFactor: 1.2 });
    // 20.000 × 1,2 × 1,5 = 36.000 / 0,94 = 38.297,87 → 38.300
    expect(r.overtimeHourPrice).toBe(38_300);
  });

  it("precio mínimo: avisa, no sube el precio", () => {
    const r = run({ minimumJobPrice: "1500000" });
    expect(r.belowMinimum).toBe(true);
    expect(r.priceWithoutVat).toBe(1_000_000);
    expect(r.warnings.join(" ")).toMatch(/mínimo/);
  });

  it("impuestos y comisión imposibles (≥ 100 %): no se aplica el gross-up y se avisa", () => {
    const r = run({ grossIncomePercent: "60", paymentCommissionPercent: "50" });
    expect(r.priceWithoutVat).toBe(1_000_000);
    expect(r.warnings.join(" ")).toMatch(/Impuestos y comisión/);
  });

  it("la política de cancelación viaja tal cual", () => {
    expect(run({ cancellationPolicy: "  La seña no se devuelve.  " }).cancellationPolicy).toBe("La seña no se devuelve.");
  });
});
