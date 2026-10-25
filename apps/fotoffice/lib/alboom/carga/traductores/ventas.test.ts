import { describe, expect, it } from "vitest";
import { COSTO_PEDIDO, CUOTA_1, CUOTA_2, ITEM_PEDIDO, PAGO, PEDIDO, PRESUPUESTO, PRESUPUESTO_DETALLE, crudo } from "../ejemplos-alboom";
import { DUDAS_8B2, MOTIVOS_8B2 } from "./historia";
import {
  asientosPorPedido,
  consumidosPorCostos,
  emparejarCostos,
  estadoDePedido,
  itemsDeAlboom,
  posicionesDeCuotas,
  traducirCostoPedido,
  traducirCuota,
  traducirPedido,
  traducirPresupuesto,
  type CtxCostosPedido,
  type CtxPedidos,
  type CtxPresupuestos,
} from "./ventas";

describe("ítems", () => {
  it("renglones de Alboom → ítems de FOTOFFICE con producto, descuento % y 'Otros gastos'", () => {
    const items = itemsDeAlboom([{ ...ITEM_PEDIDO, discount: "10" }, "basura"], new Map([["55", "p1"]]), "5000");
    expect(items).toEqual([
      expect.objectContaining({ id: "alb-1", productId: "p1", nombre: "Cobertura fotográfica de evento", cantidad: 2, precioUnitario: 150000, descuento: { tipo: "PORCENTAJE", valor: 10 }, modoPrecio: "LISTA" }),
      expect.objectContaining({ id: "alb-2", productId: null, nombre: "Otros gastos", precioUnitario: 5000 }),
    ]);
  });
});

describe("presupuestos", () => {
  const ctx = (over: Partial<CtxPresupuestos> = {}): CtxPresupuestos => ({
    leadDe: new Map([["3001", "lead1"]]),
    clienteDeLead: new Map([["3001", "cli1"]]),
    contactoDe: new Map([["7001", "cli1"]]),
    productoDe: new Map([["55", "p1"]]),
    usuarioDe: new Map([["1", "7"]]),
    detalle: new Map([["900", PRESUPUESTO_DETALLE]]),
    aceptados: new Set(),
    hoy: "2026-09-05",
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("con los ítems del detalle, totales recalculados, validez y estado", () => {
    const d = traducirPresupuesto(crudo("presupuestos", "900", PRESUPUESTO), ctx());
    expect(d).toMatchObject({ accion: "CREAR", datos: { consultaLeadId: "lead1", clientId: "cli1", status: "ENVIADO", validUntil: "2026-09-17", sentAt: "2026-09-02T12:00:00.000Z", terms: "Seña del 30%", ownerUserId: 7, numero: "900" } });
    expect((d.extra!.totals as { total: number }).total).toBe(300000);
    expect(d.dudas).toBeUndefined();
  });

  it("usado por un pedido → ACEPTADO; enviado y vencido → VENCIDO; total distinto → duda; sin consulta → OMITIR", () => {
    expect(traducirPresupuesto(crudo("presupuestos", "900", PRESUPUESTO), ctx({ aceptados: new Set(["900"]) })).datos).toMatchObject({ status: "ACEPTADO" });
    expect(traducirPresupuesto(crudo("presupuestos", "900", PRESUPUESTO), ctx({ hoy: "2026-10-25" })).datos).toMatchObject({ status: "VENCIDO" });
    expect(traducirPresupuesto(crudo("presupuestos", "900", PRESUPUESTO), ctx({ detalle: new Map([["900", { ...PRESUPUESTO_DETALLE, total: "1" }]]) })).dudas).toEqual([DUDAS_8B2.totalDistinto]);
    expect(traducirPresupuesto(crudo("presupuestos", "901", { ...PRESUPUESTO, lead_id: "1" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.consultaSinCargar });
  });
});

describe("pedidos", () => {
  const ctx = (over: Partial<CtxPedidos> = {}): CtxPedidos => ({
    contactoDe: new Map([["7001", "cli1"]]),
    leadDe: new Map([["3001", "lead1"]]),
    presupuestoDe: new Map([["900", "pres1"]]),
    productoDe: new Map([["55", "p1"]]),
    usuarioDe: new Map([["1", "7"]]),
    detalle: new Map(),
    itemsDe: new Map([["2025093", [{ alboomId: "2025093/1", p: ITEM_PEDIDO }]]]),
    numeros: new Set(),
    presupuestosConPedido: new Set(),
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("respeta el número, el estado y las fechas de Alboom", () => {
    const d = traducirPedido(crudo("pedidos", "2025093", PEDIDO), ctx());
    expect(d).toMatchObject({
      accion: "CREAR",
      datos: { number: "2025093", clientId: "cli1", consultaLeadId: "lead1", presupuestoId: "pres1", status: "COMPLETADO", totalArs: "300000.00", eventDate: "2025-03-14", contratante1: "cli1", createdAt: "2026-09-10T14:00:00.000Z" },
    });
    expect(String(d.datos!.nota)).toContain("Estado en Alboom: Venta Completada");
    expect(String(d.datos!.nota)).toContain("Memo: Pidió álbum aparte");
  });

  it("estados: cancelado con motivo, abierto queda confirmado con duda, venta completada con evento futuro queda confirmada", () => {
    expect(estadoDePedido("474", null)).toEqual({ status: "CANCELADO", abierto: false });
    expect(estadoDePedido("476", null).status).toBe("COMPLETADO");
    expect(estadoDePedido("475", "2026-12-01").status).toBe("CONFIRMADO");
    expect(traducirPedido(crudo("pedidos", "2025093", { ...PEDIDO, status_id: "474" }), ctx()).datos).toMatchObject({ status: "CANCELADO", cancelReason: "Cancelado en Alboom" });
    expect(traducirPedido(crudo("pedidos", "2025093", { ...PEDIDO, status_id: "471" }), ctx()).dudas).toContain(DUDAS_8B2.pedidoAbierto);
  });

  it("número ocupado → ALB-; presupuesto que ya tiene pedido → sin presupuesto; sin contacto → OMITIR", () => {
    expect(traducirPedido(crudo("pedidos", "2025093", PEDIDO), ctx({ numeros: new Set(["2025093"]) }))).toMatchObject({ datos: { number: "ALB-2025093" }, dudas: [DUDAS_8B2.numeroOcupado] });
    expect(traducirPedido(crudo("pedidos", "2025093", PEDIDO), ctx({ presupuestosConPedido: new Set(["pres1"]) }))).toMatchObject({ datos: { presupuestoId: null }, dudas: [DUDAS_8B2.presupuestoUsado] });
    expect(traducirPedido(crudo("pedidos", "1", { ...PEDIDO, customer_id: "9" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar });
  });
});

describe("cuotas y costos", () => {
  const plan = [crudo("pedidos_plan_pagos", "2025093/42", CUOTA_2), crudo("pedidos_plan_pagos", "2025093/41", CUOTA_1)];

  it("cuota con posición por vencimiento, medio sugerido; borrada, en cero o sin pedido → OMITIR", () => {
    const pos = posicionesDeCuotas(plan);
    expect(Object.fromEntries(pos)).toEqual({ "2025093/41": 1, "2025093/42": 2 });
    const ctx = { pedidoDe: new Map([["2025093", "ped1"]]), metodoDe: new Map(), posicion: pos, existentes: new Set<string>(), mapa: new Map() };
    expect(traducirCuota(plan[0]!, ctx)).toMatchObject({ accion: "CREAR", datos: { pedidoId: "ped1", position: 2, dueDate: "2026-11-10", amountArs: "200000.00", suggestedMethod: "TRANSFERENCIA" } });
    expect(traducirCuota(crudo("pedidos_plan_pagos", "2025093/43", { ...CUOTA_1, deleted: "1" }), ctx).accion).toBe("OMITIR");
    expect(traducirCuota(crudo("pedidos_plan_pagos", "2025093/44", { ...CUOTA_1, value: "0" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero });
    expect(traducirCuota(crudo("pedidos_plan_pagos", "1/41", CUOTA_1), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.pedidoSinCargar });
  });

  it("costo pagado: toma fecha y medio del pago de Alboom del mismo pedido e importe, que queda consumido", () => {
    const costos = [crudo("pedidos_costos", "2025093/71", COSTO_PEDIDO)];
    const pagos = asientosPorPedido([crudo("pagos", "6201", PAGO)]);
    const emp = emparejarCostos(costos, pagos, new Map(), () => true);
    expect(consumidosPorCostos(emp)).toEqual(new Set(["6201"]));
    const ctx: CtxCostosPedido = { pedidoDe: new Map([["2025093", "ped1"]]), contactoDe: new Map([["7004", "cli4"]]), rubroPorNombre: new Map([["fotografos freelancers", "rub1"]]), emparejado: emp, existentes: new Set(), mapa: new Map() };
    expect(traducirCostoPedido(costos[0]!, ctx)).toMatchObject({
      accion: "CREAR",
      datos: { pedidoId: "ped1", supplierClientId: "cli4", concept: "Segundo fotógrafo", amountArs: "40000.00", dueDate: "2025-03-20", costCategoryId: "rub1", paidAt: "2025-03-21T13:00:00.000Z", paidMethod: "TRANSFERENCIA" },
    });
    // Sin pago que empareje: pagado al vencimiento, con duda. Sin pedido cargado: no consume nada.
    const sin = traducirCostoPedido(costos[0]!, { ...ctx, emparejado: new Map() });
    expect(sin).toMatchObject({ datos: { paidAt: "2025-03-20T15:00:00.000Z", paidMethod: "OTRO" }, dudas: [DUDAS_8B2.pagoSinFecha] });
    expect(emparejarCostos(costos, pagos, new Map(), () => false).size).toBe(0);
  });
});
