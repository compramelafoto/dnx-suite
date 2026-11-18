import { describe, expect, it } from "vitest";
import {
  calcularBonificacion, descuentoDelRenglonMinor, itemsConBonificacion, repartirBonificacion, textoBonificacion, totalesConBonificacion,
  validarPrecioNoDigitalizable,
} from "./bonificacion";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { validarItems } from "@/lib/presupuestos/constantes";

const renglon = (cantidad: number, precio: number, descuento: unknown = null) => ({
  id: "m1", productId: "prod", nombre: "Digitalización de VHS", descripcion: null, cantidad, precioUnitario: precio, descuento,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false,
});
const totalesDe = (items: ReturnType<typeof renglon>[]) => calcularTotales(items as never, null);

describe("validarPrecioNoDigitalizable", () => {
  it("vacío = se cobra completo; números de 0 en adelante con hasta dos decimales", () => {
    expect(validarPrecioNoDigitalizable("")).toEqual({ ok: true, precio: null });
    expect(validarPrecioNoDigitalizable(null)).toEqual({ ok: true, precio: null });
    expect(validarPrecioNoDigitalizable("2000")).toEqual({ ok: true, precio: 2000 });
    expect(validarPrecioNoDigitalizable("1500,5")).toEqual({ ok: true, precio: 1500.5 });
    expect(validarPrecioNoDigitalizable(0)).toEqual({ ok: true, precio: 0 });
    for (const malo of ["-1", "abc", "10.123", 1e12, {}]) expect(validarPrecioNoDigitalizable(malo)).toMatchObject({ ok: false });
  });
});

describe("calcularBonificacion", () => {
  it("20 cassettes a 12.000 y se cobra 2.000: se descuentan 10.000", () => {
    const items = [renglon(20, 12000)];
    expect(calcularBonificacion({ items, totals: totalesDe(items), pedidoItemIndex: 0, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 2000 }))
      .toEqual({ ok: true, itemId: "m1", precioCassetteArs: 12000, bonificacionArs: 10000 });
  });
  it("el segundo cassette que falla se descuenta igual que el primero (suma de vuelta lo ya descontado)", () => {
    const items = [renglon(20, 12000, { tipo: "MONTO", valor: 10000 })];
    expect(calcularBonificacion({ items, totals: totalesDe(items), pedidoItemIndex: 0, bonificacionesPreviasArs: 10000, precioNoDigitalizableArs: 2000 }))
      .toMatchObject({ ok: true, bonificacionArs: 10000 });
  });
  it("con descuento propio del renglón, el cassette vale su neto", () => {
    const items = [renglon(2, 12000, { tipo: "PORCENTAJE", valor: 10 })];
    expect(calcularBonificacion({ items, totals: totalesDe(items), pedidoItemIndex: 0, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 2000 }))
      .toMatchObject({ ok: true, precioCassetteArs: 10800, bonificacionArs: 8800 });
  });
  it("sin precio, sin renglón o con un cassette que ya vale eso o menos: nada", () => {
    const items = [renglon(1, 12000)];
    const totals = totalesDe(items);
    expect(calcularBonificacion({ items, totals, pedidoItemIndex: 0, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: null })).toEqual({ ok: false, motivo: "SIN_PRECIO" });
    expect(calcularBonificacion({ items, totals, pedidoItemIndex: null, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 2000 })).toEqual({ ok: false, motivo: "SIN_RENGLON" });
    expect(calcularBonificacion({ items, totals, pedidoItemIndex: 3, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 2000 })).toEqual({ ok: false, motivo: "SIN_RENGLON" });
    expect(calcularBonificacion({ items, totals, pedidoItemIndex: 0, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 12000 })).toEqual({ ok: false, motivo: "NADA" });
  });
  it("nunca deja el renglón por debajo de cero", () => {
    const items = [renglon(1, 12000, { tipo: "MONTO", valor: 11000 })];
    expect(calcularBonificacion({ items, totals: totalesDe(items), pedidoItemIndex: 0, bonificacionesPreviasArs: 0, precioNoDigitalizableArs: 0 }))
      .toMatchObject({ ok: true, bonificacionArs: 1000 });
  });
});

describe("renglón y totales con la bonificación", () => {
  it("el descuento queda como MONTO y los totales cuadran con un cálculo desde cero; deshacerlo vuelve al original", () => {
    const items = [renglon(2, 12000, { tipo: "PORCENTAJE", valor: 10 }), { ...renglon(1, 26000), id: "m2", nombre: "Pendrive" }];
    const totals = totalesDe(items);
    const d = descuentoDelRenglonMinor(totals, "m1")!;
    expect(d).toBe(240000);
    const nuevos = itemsConBonificacion(items, "m1", d, 8800)!;
    expect((nuevos[0] as { descuento: unknown }).descuento).toEqual({ tipo: "MONTO", valor: 11200 });
    expect(validarItems(nuevos).ok).toBe(true);
    const t = totalesConBonificacion(totals, "m1", null, 8800);
    const recalculado = totalesDe(nuevos as never);
    expect(t).toMatchObject({ total: recalculado.total, descuentoItems: recalculado.descuentoItems, subtotal: recalculado.subtotal });
    expect((t.renglones as Record<string, unknown>).m1).toEqual(recalculado.renglones.m1);
    expect(t.secciones).toEqual(recalculado.secciones);
    // Deshacer: el renglón vuelve a descontar lo de antes (como MONTO) y el total vuelve.
    const vuelta = itemsConBonificacion(nuevos, "m1", descuentoDelRenglonMinor(t, "m1")!, -8800)!;
    expect((vuelta[0] as { descuento: unknown }).descuento).toEqual({ tipo: "MONTO", valor: 2400 });
    expect(totalesConBonificacion(t, "m1", null, -8800).total).toBe(totals.total);
  });
  it("sin descuento previo, deshacer deja el renglón sin descuento; un renglón que no está o que descuenta menos: null", () => {
    const items = [renglon(1, 12000)];
    const con = itemsConBonificacion(items, "m1", 0, 10000)!;
    expect(itemsConBonificacion(con, "m1", 1000000, -10000)![0]).toMatchObject({ descuento: null });
    expect(itemsConBonificacion(items, "otro", 0, 10000)).toBeNull();
    expect(itemsConBonificacion(items, "m1", 0, -10000)).toBeNull();
  });
});

describe("repartirBonificacion", () => {
  const cuotas = [
    { id: "sena", position: 1, montoMinor: 600000, libre: false },
    { id: "saldo", position: 2, montoMinor: 600000, libre: true },
  ];
  it("sale de la última cuota libre; si la deja en cero, se borra", () => {
    expect(repartirBonificacion(cuotas, 400000)).toEqual([{ id: "saldo", montoMinor: 200000 }]);
    expect(repartirBonificacion(cuotas, 600000)).toEqual([{ id: "saldo", montoMinor: 0 }]);
  });
  it("si las cuotas libres no alcanzan (el cliente ya pagó): null, no se toca nada", () => {
    expect(repartirBonificacion(cuotas, 700000)).toBeNull();
    expect(repartirBonificacion([{ ...cuotas[0]! }], 100)).toBeNull();
  });
  it("de la última hacia atrás, por varias cuotas", () => {
    const tres = [...cuotas, { id: "c3", position: 3, montoMinor: 100000, libre: true }];
    expect(repartirBonificacion(tres, 300000)).toEqual([{ id: "c3", montoMinor: 0 }, { id: "saldo", montoMinor: 400000 }]);
  });
});

it("textoBonificacion", () => {
  expect(textoBonificacion(10000, 2000)).toBe("Se cobra 2.000 pesos · descuento de 10.000 pesos en el pedido");
  expect(textoBonificacion(10000, null)).toBe("descuento de 10.000 pesos en el pedido");
});
