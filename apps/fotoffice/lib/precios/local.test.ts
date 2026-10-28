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
  it("cuenta por la hora de pared sin zona y omite meses sin movimientos", () => {
    const r = sumarVentasPorMes(
      [
        { occurredAt: new Date("2026-09-30T23:30:00Z"), amountArs: 100 },
        { occurredAt: new Date("2026-09-01T00:00:00Z"), amountArs: 50 },
        { occurredAt: new Date("2026-07-15T12:00:00Z"), amountArs: 10 },
        { occurredAt: new Date("2026-10-01T00:00:00Z"), amountArs: 999 },
      ],
      meses,
    );
    expect(r).toEqual({ months: [{ month: "2026-09", sales: 150 }, { month: "2026-07", sales: 10 }] });
  });
});
