import { describe, expect, it } from "vitest";
import { allocatePayment, allocationBalances } from "./allocate";
import type { OpenCharge } from "./select-charges";

function cargo(period: string, balanceMinor: number): OpenCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    balanceMinor,
  };
}

const CUOTA = 4700000; // $47.000,00

describe("allocatePayment", () => {
  it("imputa de la más vieja a la más nueva", () => {
    const plan = allocatePayment({
      amountMinor: CUOTA * 2,
      charges: [cargo("2026-08", CUOTA), cargo("2026-06", CUOTA), cargo("2026-07", CUOTA)],
    });
    expect(plan.allocations.map((a) => a.chargeId)).toEqual(["c-2026-06", "c-2026-07"]);
    expect(plan.unappliedMinor).toBe(0);
  });

  it("un pago parcial deja saldo en el cargo más viejo y no toca los otros", () => {
    const plan = allocatePayment({
      amountMinor: 1200000,
      charges: [cargo("2026-06", CUOTA), cargo("2026-07", CUOTA)],
    });
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0]).toMatchObject({
      chargeId: "c-2026-06",
      principalMinor: 1200000,
      remainingMinor: CUOTA - 1200000,
    });
  });

  it("un pago que cubre de más deja el sobrante declarado, no lo pierde", () => {
    const plan = allocatePayment({ amountMinor: CUOTA + 500000, charges: [cargo("2026-06", CUOTA)] });
    expect(plan.allocations[0]?.remainingMinor).toBe(0);
    expect(plan.unappliedMinor).toBe(500000);
  });

  it("sin cargos abiertos, todo el pago queda a favor", () => {
    const plan = allocatePayment({ amountMinor: CUOTA, charges: [] });
    expect(plan.allocations).toHaveLength(0);
    expect(plan.unappliedMinor).toBe(CUOTA);
  });

  it("ignora los cargos ya cancelados", () => {
    const plan = allocatePayment({
      amountMinor: CUOTA,
      charges: [cargo("2026-05", 0), cargo("2026-06", CUOTA)],
    });
    expect(plan.allocations.map((a) => a.chargeId)).toEqual(["c-2026-06"]);
  });

  it("un importe inválido no imputa nada", () => {
    expect(allocatePayment({ amountMinor: 0, charges: [cargo("2026-06", CUOTA)] }).allocations).toHaveLength(0);
    expect(allocatePayment({ amountMinor: -1, charges: [cargo("2026-06", CUOTA)] }).allocations).toHaveLength(0);
    expect(allocatePayment({ amountMinor: 10.5, charges: [cargo("2026-06", CUOTA)] }).allocations).toHaveLength(0);
  });

  it("cada centavo queda imputado o declarado como sobrante", () => {
    const casos = [
      { amountMinor: 1, charges: [cargo("2026-06", CUOTA)] },
      { amountMinor: CUOTA * 3 + 7, charges: [cargo("2026-06", CUOTA), cargo("2026-07", CUOTA)] },
      { amountMinor: 999999, charges: [] },
      { amountMinor: CUOTA, charges: [cargo("2026-06", 1), cargo("2026-07", 2)] },
    ];
    for (const caso of casos) {
      const plan = allocatePayment(caso);
      expect(allocationBalances(plan, caso.amountMinor)).toBe(true);
    }
  });

  it("no imputa más de lo que el cargo debe", () => {
    const plan = allocatePayment({
      amountMinor: CUOTA * 10,
      charges: [cargo("2026-06", 100), cargo("2026-07", 200)],
    });
    expect(plan.allocations.map((a) => a.principalMinor)).toEqual([100, 200]);
    expect(plan.unappliedMinor).toBe(CUOTA * 10 - 300);
  });
});
