import { describe, expect, it } from "vitest";
import { planCreditApplication } from "./apply-credit";
import type { OpenCharge } from "./select-charges";

function cargo(period: string, balanceMinor: number, id = `c-${period}`): OpenCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    balanceMinor,
  };
}

describe("planCreditApplication", () => {
  it("sin crédito no imputa nada", () => {
    expect(planCreditApplication({ credits: [], charges: [cargo("2026-10", 800000)] })).toEqual([]);
  });

  it("sin cargos abiertos no imputa nada: el crédito espera", () => {
    expect(planCreditApplication({ credits: [{ paymentId: "p", remainingMinor: 800000 }], charges: [] }))
      .toEqual([]);
  });

  it("imputa el crédito al cargo y lo deja saldado", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 800000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "p", chargeId: "c-2026-10", amountMinor: 800000, chargeRemainingMinor: 0 },
    ]);
  });

  it("un crédito grande cubre varios cargos, del más viejo al más nuevo", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 2000000 }],
      charges: [cargo("2026-11", 800000), cargo("2026-10", 800000)],
    });
    expect(r.map((a) => a.chargeId)).toEqual(["c-2026-10", "c-2026-11"]);
    expect(r.every((a) => a.chargeRemainingMinor === 0)).toBe(true);
  });

  it("un crédito que no alcanza deja el cargo parcialmente pago", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 300000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "p", chargeId: "c-2026-10", amountMinor: 300000, chargeRemainingMinor: 500000 },
    ]);
  });

  it("varios créditos se consumen del más viejo al más nuevo", () => {
    const r = planCreditApplication({
      credits: [
        { paymentId: "viejo", remainingMinor: 500000 },
        { paymentId: "nuevo", remainingMinor: 900000 },
      ],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "viejo", chargeId: "c-2026-10", amountMinor: 500000, chargeRemainingMinor: 300000 },
      { paymentId: "nuevo", chargeId: "c-2026-10", amountMinor: 300000, chargeRemainingMinor: 0 },
    ]);
  });

  it("no imputa más de lo que hay: cada centavo del crédito o se usa o queda", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 2000000 }],
      charges: [cargo("2026-10", 800000)],
    });
    expect(r.reduce((s, a) => s + a.amountMinor, 0)).toBe(800000);
  });

  it("ignora cargos ya saldados", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 800000 }],
      charges: [cargo("2026-09", 0), cargo("2026-10", 800000)],
    });
    expect(r.map((a) => a.chargeId)).toEqual(["c-2026-10"]);
  });

  it("un crédito insuficiente se reparte entre varios cargos sin duplicarse", () => {
    const r = planCreditApplication({
      credits: [{ paymentId: "p", remainingMinor: 1000000 }],
      charges: [cargo("2026-10", 800000), cargo("2026-11", 800000)],
    });
    expect(r).toEqual([
      { paymentId: "p", chargeId: "c-2026-10", amountMinor: 800000, chargeRemainingMinor: 0 },
      { paymentId: "p", chargeId: "c-2026-11", amountMinor: 200000, chargeRemainingMinor: 600000 },
    ]);
    expect(r.reduce((s, a) => s + a.amountMinor, 0)).toBe(1000000);
  });
});
