import { describe, expect, it } from "vitest";
import { lineTotalMinor, ticketTotals, validateTicket } from "./ticket";

const renglon = (qty: number, precio: number, over = false) => ({
  productId: "p1", description: "Trípode", qty, unitPriceMinor: precio,
  unitCostMinor: null, priceWasOverridden: over,
});

describe("lineTotalMinor", () => {
  it("multiplica cantidad por precio", () => {
    expect(lineTotalMinor({ qty: 3, unitPriceMinor: 1_250_00 })).toBe(3_750_00);
  });

  it("una unidad da el precio", () => {
    expect(lineTotalMinor({ qty: 1, unitPriceMinor: 999_99 })).toBe(999_99);
  });

  it("no pierde centavos multiplicando", () => {
    expect(lineTotalMinor({ qty: 7, unitPriceMinor: 3_33 })).toBe(23_31);
  });
});

describe("ticketTotals", () => {
  it("suma los renglones", () => {
    const r = ticketTotals([renglon(2, 1_000_00), renglon(1, 500_00)], 0);
    expect(r.subtotalMinor).toBe(2_500_00);
    expect(r.totalMinor).toBe(2_500_00);
  });

  it("resta el descuento", () => {
    const r = ticketTotals([renglon(2, 1_000_00)], 200_00);
    expect(r.subtotalMinor).toBe(2_000_00);
    expect(r.discountMinor).toBe(200_00);
    expect(r.totalMinor).toBe(1_800_00);
  });

  it("un ticket vacío da todo en cero y no null", () => {
    expect(ticketTotals([], 0)).toEqual({ subtotalMinor: 0, discountMinor: 0, totalMinor: 0 });
  });

  it("un descuento igual al subtotal deja el total en cero", () => {
    expect(ticketTotals([renglon(1, 500_00)], 500_00).totalMinor).toBe(0);
  });

  it("cien renglones chicos no pierden un centavo", () => {
    const muchos = Array.from({ length: 100 }, () => renglon(3, 3_33));
    expect(ticketTotals(muchos, 0).subtotalMinor).toBe(999_00);
  });
});

describe("validateTicket", () => {
  it("un ticket normal se acepta", () => {
    expect(validateTicket([renglon(1, 1_000_00)], 0)).toEqual({ ok: true });
  });

  it("un ticket sin renglones no se cobra", () => {
    expect(validateTicket([], 0)).toEqual({
      ok: false,
      error: "Agregá algo al ticket antes de cobrar.",
    });
  });

  it("una cantidad de cero o negativa se rechaza", () => {
    expect(validateTicket([renglon(0, 1_000_00)], 0).ok).toBe(false);
    expect(validateTicket([renglon(-2, 1_000_00)], 0).ok).toBe(false);
  });

  it("un precio negativo se rechaza: un descuento no es un precio al revés", () => {
    expect(validateTicket([renglon(1, -500_00)], 0)).toEqual({
      ok: false,
      error: "Ningún renglón puede tener precio negativo.",
    });
  });

  it("un precio de cero SÍ se acepta: hay cosas que se entregan sin cargo", () => {
    expect(validateTicket([renglon(1, 0)], 0)).toEqual({ ok: true });
  });

  it("un descuento mayor que el subtotal se rechaza: el total no puede dar negativo", () => {
    expect(validateTicket([renglon(1, 500_00)], 600_00)).toEqual({
      ok: false,
      error: "El descuento no puede ser mayor que el total.",
    });
  });

  it("un descuento negativo se rechaza", () => {
    expect(validateTicket([renglon(1, 500_00)], -100_00)).toEqual({
      ok: false,
      error: "El descuento no puede ser negativo.",
    });
  });

  it("un renglón sin descripción se rechaza: la venta se lee dentro de dos años", () => {
    const sinNombre = { ...renglon(1, 100_00), description: "  " };
    expect(validateTicket([sinNombre], 0)).toEqual({
      ok: false,
      error: "Todos los renglones necesitan una descripción.",
    });
  });
});
