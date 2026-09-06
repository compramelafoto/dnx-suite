import { describe, expect, it } from "vitest";
import { MAX_ADVANCE_MONTHS, planAdvancePeriods } from "./advance";

const BASE = { fromPeriod: "2026-10", feeValueMinor: 800000, dueDay: 10 };

describe("planAdvancePeriods", () => {
  it("un mes adelantado es un solo período, al valor vigente", () => {
    expect(planAdvancePeriods({ ...BASE, months: 1 })).toEqual([
      { period: "2026-10", amountMinor: 800000, dueDate: new Date(Date.UTC(2026, 9, 10)) },
    ]);
  });

  it("varios meses son meses consecutivos", () => {
    const r = planAdvancePeriods({ ...BASE, months: 3 });
    expect(r.map((p) => p.period)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("cruza el año sin inventar un mes 13", () => {
    const r = planAdvancePeriods({ ...BASE, fromPeriod: "2026-11", months: 3 });
    expect(r.map((p) => p.period)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("no deja adelantar más que el tope", () => {
    expect(planAdvancePeriods({ ...BASE, months: 99 })).toHaveLength(MAX_ADVANCE_MONTHS);
  });

  it("un pedido de cero o negativo no devuelve nada", () => {
    expect(planAdvancePeriods({ ...BASE, months: 0 })).toEqual([]);
    expect(planAdvancePeriods({ ...BASE, months: -3 })).toEqual([]);
  });

  it("sin valor de cuota no se ofrece nada: no se cobra un precio que no está fijado", () => {
    expect(planAdvancePeriods({ ...BASE, months: 3, feeValueMinor: 0 })).toEqual([]);
  });

  it("un mes con menos días no corre el vencimiento al mes siguiente", () => {
    // Día 31 en febrero: se topea, nunca se desborda.
    const r = planAdvancePeriods({ fromPeriod: "2027-02", months: 1, feeValueMinor: 800000, dueDay: 31 });
    expect(r[0]?.dueDate).toEqual(new Date(Date.UTC(2027, 1, 28)));
  });

  it("un período mal formado no devuelve nada en vez de inventar una fecha", () => {
    expect(planAdvancePeriods({ ...BASE, fromPeriod: "octubre", months: 2 })).toEqual([]);
  });
});
