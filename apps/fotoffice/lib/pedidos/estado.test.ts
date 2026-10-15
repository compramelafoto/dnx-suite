import { describe, expect, it } from "vitest";
import { ESTADOS_PEDIDO } from "./constantes";
import { estadoDeCuota, estadosSiguientes, puedePasarPedido, resumenDePlan, type CuotaLeida } from "./estado";

describe("estados del pedido", () => {
  it("CONFIRMADO → EN_CURSO → COMPLETADO, sin saltear ni volver", () => {
    expect(puedePasarPedido("CONFIRMADO", "EN_CURSO")).toBe(true);
    expect(puedePasarPedido("EN_CURSO", "COMPLETADO")).toBe(true);
    expect(puedePasarPedido("CONFIRMADO", "COMPLETADO")).toBe(false);
    expect(puedePasarPedido("EN_CURSO", "CONFIRMADO")).toBe(false);
    expect(puedePasarPedido("COMPLETADO", "EN_CURSO")).toBe(false);
  });

  it("CANCELADO desde cualquiera salvo COMPLETADO, y de CANCELADO no se vuelve", () => {
    expect(puedePasarPedido("CONFIRMADO", "CANCELADO")).toBe(true);
    expect(puedePasarPedido("EN_CURSO", "CANCELADO")).toBe(true);
    expect(puedePasarPedido("COMPLETADO", "CANCELADO")).toBe(false);
    for (const e of ESTADOS_PEDIDO) expect(puedePasarPedido("CANCELADO", e)).toBe(false);
    expect(estadosSiguientes("CANCELADO")).toEqual([]);
  });
});

describe("estado de cada cuota", () => {
  const hoy = "2026-10-08";
  const ctx = { hoy, pedidoCancelado: false };

  it("PAGADA, PARCIAL, VENCIDA y PENDIENTE", () => {
    expect(estadoDeCuota({ amountArs: 100, imputado: 100, dueDate: "2026-09-01" }, ctx)).toBe("PAGADA");
    expect(estadoDeCuota({ amountArs: 100, imputado: 40, dueDate: "2026-10-08" }, ctx)).toBe("PARCIAL");
    expect(estadoDeCuota({ amountArs: 100, imputado: 40, dueDate: "2026-10-07" }, ctx)).toBe("VENCIDA");
    expect(estadoDeCuota({ amountArs: 100, imputado: 0, dueDate: "2026-10-07" }, ctx)).toBe("VENCIDA");
    // El mismo día del vencimiento todavía no está vencida.
    expect(estadoDeCuota({ amountArs: 100, imputado: 0, dueDate: hoy }, ctx)).toBe("PENDIENTE");
  });

  it("CANCELADA con el pedido cancelado y saldo; pagada sigue pagada", () => {
    const cancelado = { hoy, pedidoCancelado: true };
    expect(estadoDeCuota({ amountArs: 100, imputado: 0, dueDate: "2026-09-01" }, cancelado)).toBe("CANCELADA");
    expect(estadoDeCuota({ amountArs: 100, imputado: 30, dueDate: "2026-12-01" }, cancelado)).toBe("CANCELADA");
    expect(estadoDeCuota({ amountArs: 100, imputado: 100, dueDate: "2026-12-01" }, cancelado)).toBe("PAGADA");
  });
});

describe("resumen del plan", () => {
  const cuotas: CuotaLeida[] = [
    { id: "c2", position: 2, dueDate: "2026-11-08", amountArs: 333.33, suggestedMethod: null },
    { id: "c1", position: 1, dueDate: "2026-10-01", amountArs: 333.33, suggestedMethod: null },
    { id: "c3", position: 3, dueDate: "2026-12-08", amountArs: 333.34, suggestedMethod: "TRANSFERENCIA" },
  ];

  it("saldo por cuota y del pedido; las imputaciones de cobros anulados no cuentan", () => {
    const r = resumenDePlan(
      cuotas,
      [
        { cuotaId: "c1", amountArs: 100, anulada: false },
        { cuotaId: "c1", amountArs: 233.33, anulada: true },
        { cuotaId: "c2", amountArs: 0.33, anulada: false },
        { cuotaId: "otra", amountArs: 50, anulada: false },
      ],
      { hoy: "2026-10-08", estadoPedido: "EN_CURSO", total: 1000 },
    );
    expect(r.cuotas.map((c) => [c.id, c.imputado, c.saldo, c.estado])).toEqual([
      ["c1", 100, 233.33, "VENCIDA"],
      ["c2", 0.33, 333, "PARCIAL"],
      ["c3", 0, 333.34, "PENDIENTE"],
    ]);
    expect(r.cobrado).toBe(100.33);
    expect(r.saldo).toBe(899.67);
    expect(r.aCobrar).toBe(899.67);
    expect(r.vencido).toBe(233.33);
    expect(r.cuotasVencidas).toBe(1);
    expect(r.proximoVencimiento).toBe("2026-10-01");
    expect(r.descuadrado).toBe(false);
  });

  it("cancelado: las cuotas con saldo quedan canceladas y no suman a cobrar", () => {
    const r = resumenDePlan(cuotas, [{ cuotaId: "c1", amountArs: 333.33, anulada: false }], {
      hoy: "2026-10-08",
      estadoPedido: "CANCELADO",
      total: 1000,
    });
    expect(r.cuotas.map((c) => c.estado)).toEqual(["PAGADA", "CANCELADA", "CANCELADA"]);
    expect(r.saldo).toBe(666.67);
    expect(r.aCobrar).toBe(0);
    expect(r.vencido).toBe(0);
    expect(r.proximoVencimiento).toBeNull();
  });

  it("avisa el plan descuadrado y un pedido sin importe no tiene saldo", () => {
    expect(resumenDePlan(cuotas, [], { hoy: "2026-10-08", estadoPedido: "CONFIRMADO", total: 1200 }).descuadrado).toBe(true);
    const cero = resumenDePlan([], [], { hoy: "2026-10-08", estadoPedido: "CONFIRMADO", total: 0 });
    expect(cero).toMatchObject({ saldo: 0, aCobrar: 0, descuadrado: false, proximoVencimiento: null });
  });
});
