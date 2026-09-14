import { describe, expect, it } from "vitest";
import { marginByProduct, marginTotals } from "./margin";

const linea = (desc: string, qty: number, venta: number, costo: number | null) => ({
  productId: desc,
  description: desc,
  qty,
  revenueMinor: venta,
  costMinor: costo,
});

describe("marginTotals", () => {
  it("el margen es lo que se cobró menos lo que costó", () => {
    const r = marginTotals([linea("Trípode", 1, 10_000_00, 6_000_00)]);
    expect(r.revenueMinor).toBe(10_000_00);
    expect(r.costMinor).toBe(6_000_00);
    expect(r.marginMinor).toBe(4_000_00);
  });

  it("un renglón sin costo suma a la venta pero NO al costo, y se cuenta aparte", () => {
    // Contar un costo desconocido como cero infla el margen y hace creer que se ganó
    // más de lo real. Se informa cuántos renglones no tienen costo, para que el número
    // se lea sabiendo eso.
    const r = marginTotals([linea("Servicio", 1, 5_000_00, null)]);
    expect(r.revenueMinor).toBe(5_000_00);
    expect(r.costMinor).toBe(0);
    expect(r.marginMinor).toBe(5_000_00);
    expect(r.withoutCostCount).toBe(1);
  });

  it("sin renglones, todo en cero y no null", () => {
    expect(marginTotals([])).toEqual({
      revenueMinor: 0,
      costMinor: 0,
      marginMinor: 0,
      withoutCostCount: 0,
    });
  });

  it("el margen puede ser negativo: se vendió por debajo del costo", () => {
    expect(marginTotals([linea("Oferta", 1, 1_000_00, 1_500_00)]).marginMinor).toBe(-500_00);
  });
});

describe("marginByProduct", () => {
  it("agrupa por producto y ordena por margen, de mayor a menor", () => {
    const r = marginByProduct([
      linea("Trípode", 1, 10_000_00, 6_000_00),
      linea("Portarretratos", 2, 4_000_00, 1_000_00),
      linea("Trípode", 1, 10_000_00, 6_000_00),
    ]);
    expect(r[0].description).toBe("Trípode");
    expect(r[0].qty).toBe(2);
    expect(r[0].marginMinor).toBe(8_000_00);
  });
});
