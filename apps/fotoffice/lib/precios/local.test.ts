import { describe, expect, it } from "vitest";
import { mesesCompletos, sumarVentasPorMes } from "./local";

describe("mesesCompletos", () => {
  it("devuelve los tres meses anteriores, el más reciente primero", () => {
    expect(mesesCompletos("2026-10-28")).toEqual([
      { month: "2026-09", desde: "2026-09-01", hasta: "2026-10-01" },
      { month: "2026-08", desde: "2026-08-01", hasta: "2026-09-01" },
      { month: "2026-07", desde: "2026-07-01", hasta: "2026-08-01" },
    ]);
  });
  it("en enero cruza al año anterior", () => {
    const m = mesesCompletos("2027-01-05");
    expect(m.map((x) => x.month)).toEqual(["2026-12", "2026-11", "2026-10"]);
    expect(m[0]).toEqual({ month: "2026-12", desde: "2026-12-01", hasta: "2027-01-01" });
  });
  it("respeta la cantidad", () => {
    expect(mesesCompletos("2026-10-28", 1)).toHaveLength(1);
  });
});

describe("sumarVentasPorMes", () => {
  const meses = mesesCompletos("2026-10-28");
  it("agrupa por mes argentino (instantes UTC): 01:00Z del 1/10 es septiembre, 03:00Z es octubre", () => {
    const r = sumarVentasPorMes(
      [
        { occurredAt: new Date("2026-10-01T01:00:00Z"), amountArs: 7 },
        { occurredAt: new Date("2026-10-01T03:00:00Z"), amountArs: 1000 },
        { occurredAt: new Date("2026-09-01T02:59:00Z"), amountArs: 3 },
      ],
      meses,
      new Date("2026-01-10T12:00:00Z"),
    );
    expect(r).toEqual({ months: [{ month: "2026-09", sales: 7 }, { month: "2026-08", sales: 3 }, { month: "2026-07", sales: 0 }] });
  });
  it("un mes completo sin ventas cuenta como 0 si Caja ya estaba en uso", () => {
    const r = sumarVentasPorMes(
      [
        { occurredAt: new Date("2026-09-30T23:30:00Z"), amountArs: 100 },
        { occurredAt: new Date("2026-09-01T03:00:00Z"), amountArs: 50 },
        { occurredAt: new Date("2026-07-15T12:00:00Z"), amountArs: 10 },
        { occurredAt: new Date("2026-10-01T03:00:00Z"), amountArs: 999 },
      ],
      meses,
      new Date("2026-05-02T15:00:00Z"),
    );
    expect(r).toEqual({ months: [{ month: "2026-09", sales: 150 }, { month: "2026-08", sales: 0 }, { month: "2026-07", sales: 10 }] });
  });
  it("saltea los meses anteriores a Caja y el mes en que empezó (incompleto)", () => {
    const filas = [
      { occurredAt: new Date("2026-09-10T12:00:00Z"), amountArs: 100 },
      { occurredAt: new Date("2026-08-20T12:00:00Z"), amountArs: 40 },
    ];
    // Primer movimiento de Caja: 1/8 a las 02:00Z = 31 de julio en Argentina → julio incompleto, agosto y septiembre completos.
    expect(sumarVentasPorMes(filas, meses, new Date("2026-08-01T02:00:00Z"))).toEqual({
      months: [{ month: "2026-09", sales: 100 }, { month: "2026-08", sales: 40 }],
    });
    // Primer movimiento el 20/8: agosto incompleto (se saltea aunque tenga ventas), julio todavía no existía.
    expect(sumarVentasPorMes(filas, meses, new Date("2026-08-20T12:00:00Z"))).toEqual({ months: [{ month: "2026-09", sales: 100 }] });
  });
  it("sin ningún movimiento en Caja no hay meses", () => {
    expect(sumarVentasPorMes([], meses, null)).toEqual({ months: [] });
  });
});
