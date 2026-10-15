import { describe, expect, it } from "vitest";
import { buildPriceBuildUp } from "./price-build-up";
import { summarizeJobPricing } from "./summarize";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS as BASE } from "./types";

const extras = { ...BASE, grossIncomePercent: "3", paymentCommissionPercent: "6", depositPercent: "30", minimumJobPrice: "1500000", travelMode: "per_km" as const, travelPerKm: "300" };
const linea = (basePrice: number, viaje = false) =>
  buildPriceBuildUp({ extras, adjustments: viaje ? { distanceKm: "40" } : {}, basePrice, ownServiceShare: 1, costHour: 20_000, positioningFactor: 1 });

describe("resumen del trabajo (varios renglones)", () => {
  it("suma renglones; la seña y el mínimo se miran sobre el total del trabajo", () => {
    const a = linea(1_000_000, true);
    const b = linea(400_000);
    const r = summarizeJobPricing([a, b], extras)!;
    expect(r.priceWithoutVat).toBe(a.priceWithoutVat + b.priceWithoutVat);
    expect(r.total).toBe(a.total + b.total);
    expect(r.deposit).toEqual({ percent: 30, amount: Math.round(r.total * 0.3) });
    expect(r.balance).toBe(r.total - r.deposit!.amount);
    expect(r.travelCost).toBe(24_000);
    // Por renglón, b queda bajo el mínimo; el trabajo entero no.
    expect(b.belowMinimum).toBe(true);
    expect(r.belowMinimum).toBe(false);
    expect(r.warnings.join(" ")).not.toMatch(/mínimo/);
    expect(r.overtimeHourPrice).toBe(a.overtimeHourPrice);
  });

  it("sin renglones con desglose: null", () => {
    expect(summarizeJobPricing([], extras)).toBeNull();
  });
});
