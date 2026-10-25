import { describe, expect, it } from "vitest";
import { COBRO, COBRO_SIN_PEDIDO, CUENTA_COBRAR, MOVIMIENTO_BANCO, PAGO, PAGO_SUELTO, crudo } from "../ejemplos-alboom";
import { traducirCobro, traducirCuentaCobrar, traducirCuentaPagarSuelta, traducirMovimientoBanco, traducirPagoSuelto, type CtxCobros, type CtxFinanzas, type CtxPagar } from "./finanzas";
import { DUDAS_8B2, MOTIVOS_8B2, htmlATexto, importeConSigno, instanteAr, medioDePago } from "./historia";

describe("piezas comunes", () => {
  it("fecha-hora de Alboom en hora argentina → instante UTC; fecha sola → mediodía", () => {
    expect(instanteAr("2026-09-10 12:00:00")).toBe("2026-09-10T15:00:00.000Z");
    expect(instanteAr("2026-09-10 22:30")).toBe("2026-09-11T01:30:00.000Z");
    expect(instanteAr("2026-09-10")).toBe("2026-09-10T15:00:00.000Z");
    expect(instanteAr("0000-00-00 00:00:00")).toBeNull();
  });
  it("medios de pago de DNX (doc 09), importes con signo y HTML a texto", () => {
    expect(medioDePago("Tarjeta de débito/Crédito Mercado Pago").medio).toBe("MERCADO_PAGO");
    expect(medioDePago("Transferencia Bancaria (Plataforma 360°)").medio).toBe("TRANSFERENCIA");
    expect(medioDePago('Pago de Tarjeta de Crédito "Ualá"').medio).toBe("TARJETA");
    expect(medioDePago("Cheque")).toEqual({ medio: "OTRO", conocido: true });
    expect(medioDePago("Trueque")).toEqual({ medio: "OTRO", conocido: false });
    expect(importeConSigno("-1.500,50")).toEqual({ valor: "1500.50", negativo: true });
    expect(importeConSigno(200)).toEqual({ valor: "200.00", negativo: false });
    expect(htmlATexto("<p>Hola&nbsp;<b>Lucía</b></p><ul><li>uno</li></ul><script>x()</script>")).toBe("Hola Lucía\n• uno");
  });
});

describe("cobros (ar_paid): lo cobrado de un pedido sale sólo de sus cuotas cobradas", () => {
  const ctx = (over: Partial<CtxCobros> = {}): CtxCobros => ({
    pedidoDe: new Map([["2025093", "ped1"]]),
    contactoDe: new Map([["7001", "cli1"]]),
    metodoDe: new Map(),
    bancoDe: new Map([["3", "Caja del estudio"]]),
    emparejados: new Map(),
    existentes: new Set(),
    mapa: new Map(),
    ...over,
  });

  it("el que coincide con una cuota cobrada se omite (no se cobra dos veces)", () => {
    expect(traducirCobro(crudo("cobros", "6001", COBRO), ctx({ emparejados: new Map([["6001", "2025093/41"]]) }))).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.cuotaCobrada });
  });

  it("el de un pedido que no coincide con ninguna cuota → libro histórico con duda (nunca suma al pedido)", () => {
    const d = traducirCobro(crudo("cobros", "6001", COBRO), ctx());
    expect(d).toMatchObject({ accion: "CREAR", datos: { source: "COBRO", kind: "INGRESO", amountArs: "100000.00", pedidoId: "ped1", alboomOrderId: "2025093", methodName: "Efectivo" }, dudas: [DUDAS_8B2.cobroSinCuota] });
    expect(d.datos).not.toHaveProperty("receiptNumber");
  });

  it("sin pedido → libro histórico (fuera de la Caja)", () => {
    expect(traducirCobro(crudo("cobros", "6002", COBRO_SIN_PEDIDO), ctx())).toMatchObject({
      accion: "CREAR",
      datos: { source: "COBRO", kind: "INGRESO", amountArs: "5000.00", occurredOn: "2026-08-01", accountName: "Caja del estudio", clientId: "cli1", pedidoId: null },
    });
  });
});

describe("cuentas y movimientos", () => {
  const ctx: CtxFinanzas = { pedidoDe: new Map([["2025093", "ped1"]]), contactoDe: new Map([["7001", "cli1"]]), bancoDe: new Map(), metodoDe: new Map(), existentes: new Set(), mapa: new Map() };
  it("cuenta a cobrar con pedido ya es una cuota; sin pedido, al libro histórico", () => {
    expect(traducirCuentaCobrar(crudo("cuentas_cobrar", "6101", CUENTA_COBRAR), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.cuotaDelPedido });
    expect(traducirCuentaCobrar(crudo("cuentas_cobrar", "6102", { ...CUENTA_COBRAR, order_id: null }), ctx)).toMatchObject({ datos: { source: "A_COBRAR", kind: "A_COBRAR", dueOn: "2026-11-10", amountArs: "200000.00" } });
  });
  it("movimientos de bancos: depósito → ingreso, débito → egreso, 74 → transferencia (sin contacto)", () => {
    expect(traducirMovimientoBanco(crudo("movimientos_bancos", "6301", MOVIMIENTO_BANCO), ctx).datos).toMatchObject({ source: "BANCO", kind: "INGRESO", amountArs: "80000.00", accountCode: "1.1.3", accountName: "Banco 3 de Alboom" });
    expect(traducirMovimientoBanco(crudo("movimientos_bancos", "6302", { ...MOVIMIENTO_BANCO, amount: "300" }), ctx).datos).toMatchObject({ kind: "EGRESO" });
    expect(traducirMovimientoBanco(crudo("movimientos_bancos", "6303", { ...MOVIMIENTO_BANCO, category_id: "74" }), ctx).datos).toMatchObject({ kind: "TRANSFERENCIA", clientId: null });
    expect(traducirMovimientoBanco(crudo("movimientos_bancos", "6304", { ...MOVIMIENTO_BANCO, amount: "0" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero });
  });
  it("pagos y cuentas a pagar: los que ya son costos del pedido se omiten; los sueltos se cargan sin Caja", () => {
    const pagar: CtxPagar = { pedidoDe: ctx.pedidoDe, contactoDe: new Map([["7004", "cli4"]]), metodoDe: new Map(), consumidos: new Set(["6201"]), existentes: new Set(), mapa: new Map() };
    expect(traducirPagoSuelto(crudo("pagos", "6201", PAGO), pagar)).toEqual({ accion: "OMITIR", motivo: MOTIVOS_8B2.cubiertoPorCosto });
    expect(traducirPagoSuelto(crudo("pagos", "6202", PAGO_SUELTO), pagar)).toMatchObject({ datos: { pedidoId: null, supplierClientId: "cli4", concept: "Alquiler de luces", amountArs: "15000.00", paidAt: "2026-07-01T15:00:00.000Z", paidMethod: "EFECTIVO" } });
    expect(traducirCuentaPagarSuelta(crudo("cuentas_pagar", "6401", { ...PAGO_SUELTO, id: "6401" }), pagar)).toMatchObject({ datos: { paidAt: null, paidMethod: null } });
  });
});
