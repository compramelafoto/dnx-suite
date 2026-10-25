import { describe, expect, it } from "vitest";
import { calcularTotales } from "./totales";
import type { ItemPresupuesto } from "./constantes";

function item(datos: Partial<ItemPresupuesto> & { id: string }): ItemPresupuesto {
  return {
    productId: null,
    nombre: datos.id,
    descripcion: null,
    cantidad: 1,
    precioUnitario: 0,
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion: null,
    opcional: false,
    ...datos,
  };
}

describe("calcularTotales", () => {
  it("sin ítems todo da cero", () => {
    const t = calcularTotales([], null);
    expect(t).toMatchObject({ subtotal: 0, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total: 0 });
    expect(t.opcionales).toEqual({ cantidad: 0, total: 0 });
    expect(t.secciones).toEqual([]);
  });

  it("suma cantidad × precio de cada renglón", () => {
    const t = calcularTotales([item({ id: "a", cantidad: 2, precioUnitario: 1500 }), item({ id: "b", precioUnitario: 300.5 })], null);
    expect(t.subtotal).toBe(3300.5);
    expect(t.total).toBe(3300.5);
    expect(t.renglones.a).toEqual({ bruto: 3000, descuento: 0, neto: 3000 });
  });

  it("no arrastra restos de punto flotante (0,1 + 0,2)", () => {
    const t = calcularTotales([item({ id: "a", precioUnitario: 0.1 }), item({ id: "b", precioUnitario: 0.2 })], null);
    expect(t.total).toBe(0.3);
  });

  it("descuento por ítem en % y en $", () => {
    const t = calcularTotales(
      [
        item({ id: "a", cantidad: 2, precioUnitario: 1000, descuento: { tipo: "PORCENTAJE", valor: 10 } }),
        item({ id: "b", precioUnitario: 500, descuento: { tipo: "MONTO", valor: 50 } }),
      ],
      null,
    );
    expect(t.subtotal).toBe(2500);
    expect(t.descuentoItems).toBe(250);
    expect(t.total).toBe(2250);
    expect(t.renglones.a!.neto).toBe(1800);
  });

  it("un descuento en $ mayor que el renglón lo deja en cero, nunca negativo", () => {
    const t = calcularTotales([item({ id: "a", precioUnitario: 100, descuento: { tipo: "MONTO", valor: 900 } })], null);
    expect(t.renglones.a).toEqual({ bruto: 100, descuento: 100, neto: 0 });
    expect(t.total).toBe(0);
  });

  it("descuento global en % y en $ sobre lo que quedó de los renglones", () => {
    const items = [item({ id: "a", precioUnitario: 1000, descuento: { tipo: "MONTO", valor: 200 } })];
    expect(calcularTotales(items, { tipo: "PORCENTAJE", valor: 25 })).toMatchObject({ descuentoGlobal: 200, total: 600 });
    expect(calcularTotales(items, { tipo: "MONTO", valor: 100 })).toMatchObject({ descuentoGlobal: 100, total: 700 });
    expect(calcularTotales(items, { tipo: "MONTO", valor: 5000 })).toMatchObject({ descuentoGlobal: 800, total: 0 });
  });

  it("los opcionales se muestran aparte y no suman al total ni reciben el descuento global", () => {
    const t = calcularTotales(
      [
        item({ id: "a", precioUnitario: 1000 }),
        item({ id: "op", precioUnitario: 400, opcional: true, descuento: { tipo: "PORCENTAJE", valor: 50 } }),
      ],
      { tipo: "PORCENTAJE", valor: 10 },
    );
    expect(t.subtotal).toBe(1000);
    expect(t.descuentoGlobal).toBe(100);
    expect(t.total).toBe(900);
    expect(t.opcionales).toEqual({ cantidad: 1, total: 200 });
  });

  it("agrupa por sección en el orden en que aparecen", () => {
    const t = calcularTotales(
      [
        item({ id: "a", seccion: "Cobertura", precioUnitario: 100 }),
        item({ id: "b", seccion: "Álbum", precioUnitario: 50 }),
        item({ id: "c", seccion: "Cobertura", precioUnitario: 20, opcional: true }),
        item({ id: "d", precioUnitario: 5 }),
      ],
      null,
    );
    expect(t.secciones).toEqual([
      { seccion: "Cobertura", subtotal: 100, opcionales: 20 },
      { seccion: "Álbum", subtotal: 50, opcionales: 0 },
      { seccion: null, subtotal: 5, opcionales: 0 },
    ]);
    expect(t.total).toBe(155);
  });

  it("redondea a dos decimales (cantidad fraccionaria y porcentaje)", () => {
    const t = calcularTotales([item({ id: "a", cantidad: 1.5, precioUnitario: 33.33, descuento: { tipo: "PORCENTAJE", valor: 33 } })], null);
    // 1,5 × 33,33 = 49,995 → 50,00; 33 % de 50,00 = 16,50.
    expect(t.renglones.a).toEqual({ bruto: 50, descuento: 16.5, neto: 33.5 });
  });

  it("ignora valores imposibles en vez de romper (los frena antes `validarItem`)", () => {
    const t = calcularTotales([item({ id: "a", cantidad: Number.NaN, precioUnitario: -5 })], { tipo: "PORCENTAJE", valor: 500 });
    expect(t.total).toBe(0);
  });
});
