import { describe, expect, test } from "vitest";
import { COMISION_POR_DEFECTO_BPS } from "./comision";
import { RECARGO_DE_DESCARGA_BPS, calcularVenta } from "./venta";

describe("las dos formas de vender", () => {
  test("sin descarga: el cliente paga el precio del fotógrafo", () => {
    const v = calcularVenta({ baseCents: 100_000, conDescarga: false });
    expect(v.totalCents).toBe(100_000);
    expect(v.recargoCents).toBe(0);
    expect(v.plataformaCents).toBe(15_000);
    expect(v.vendedorCents).toBe(85_000);
  });

  test("con descarga: el cliente paga un 10% más y ese 10% es de la plataforma", () => {
    const v = calcularVenta({ baseCents: 100_000, conDescarga: true });
    expect(v.totalCents).toBe(110_000);
    expect(v.recargoCents).toBe(10_000);
    // 15.000 de comisión más los 10.000 del recargo.
    expect(v.plataformaCents).toBe(25_000);
    expect(v.vendedorCents).toBe(85_000);
  });

  test("el fotógrafo cobra lo mismo venda como venda", () => {
    /*
      Es la propiedad que hace que el fotógrafo no tenga motivo para elegir una
      forma u otra por plata: incluir la descarga no le quita nada. Si algún día
      esto deja de valer, alguien va a elegir mal por la razón equivocada.
    */
    for (const base of [1, 999, 12_345, 100_000, 987_654, 5_000_000]) {
      const sin = calcularVenta({ baseCents: base, conDescarga: false });
      const con = calcularVenta({ baseCents: base, conDescarga: true });
      expect(con.vendedorCents).toBe(sin.vendedorCents);
    }
  });

  test("lo que paga el cliente siempre se reparte entero", () => {
    for (const base of [1, 7, 33, 999, 12_345, 100_000, 987_654]) {
      for (const conDescarga of [true, false]) {
        const v = calcularVenta({ baseCents: base, conDescarga });
        expect(v.plataformaCents + v.vendedorCents).toBe(v.totalCents);
      }
    }
  });

  test("el recargo es el 10% del precio del fotógrafo, no del total", () => {
    // Sobre el total sería un 10% de algo que ya incluye el recargo: se muerde
    // la cola y da un número que nadie puede explicar.
    expect(RECARGO_DE_DESCARGA_BPS).toBe(1000);
    expect(calcularVenta({ baseCents: 50_000, conDescarga: true }).recargoCents).toBe(5_000);
  });

  test("la comisión de la plataforma es el 15% del precio del fotógrafo", () => {
    expect(COMISION_POR_DEFECTO_BPS).toBe(1500);
    expect(calcularVenta({ baseCents: 200_000, conDescarga: false }).plataformaCents).toBe(30_000);
  });

  test("un precio de cero no es una venta", () => {
    expect(() => calcularVenta({ baseCents: 0, conDescarga: false })).toThrow();
    expect(() => calcularVenta({ baseCents: -1, conDescarga: true })).toThrow();
    expect(() => calcularVenta({ baseCents: 10.5, conDescarga: false })).toThrow();
  });
});

describe("el precio de la descarga sola", () => {
  test("es el mismo que el recargo cuando va incluida", async () => {
    const { precioDeLaDescarga } = await import("./venta");
    // Mismo producto, mismo precio. Cobrar distinto según cuándo se compra sería
    // difícil de explicar y fácil de discutir.
    for (const base of [1_000, 50_000, 100_000, 987_654]) {
      expect(precioDeLaDescarga(base)).toBe(
        calcularVenta({ baseCents: base, conDescarga: true }).recargoCents,
      );
    }
  });

  test("sin precio base no hay descarga que vender", async () => {
    const { precioDeLaDescarga } = await import("./venta");
    expect(precioDeLaDescarga(0)).toBe(0);
    expect(precioDeLaDescarga(-5)).toBe(0);
  });
});
