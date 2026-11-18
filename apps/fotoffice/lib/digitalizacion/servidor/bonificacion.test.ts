import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));

const { bonificarNoDigitalizable, deshacerBonificacion } = await import("./bonificacion");
const { calcularTotales } = await import("@/lib/presupuestos/totales");

const items = [{
  id: "m1", productId: "prod", nombre: "Digitalización de VHS", descripcion: null, cantidad: 3, precioUnitario: 12000, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false,
}];
const pedido = () => B.datos.fotofficePedido.find((p) => p.id === "ped-1")! as Record<string, unknown>;
const cuotas = () => B.datos.fotofficePedidoCuota.filter((c) => c.pedidoId === "ped-1").sort((a, b) => Number(a.position) - Number(b.position));
const tareas = () => B.datos.fotofficePedidoTarea.map((t) => String(t.title));
const grabacion = (id: string) => B.datos.digitalizacionGrabacion.find((g) => g.id === id)! as Record<string, unknown>;
const montos = () => cuotas().map((c) => String(c.amountArs));

function noDigitalizable(id: string) {
  B.agregar("digitalizacionGrabacion", { id, workspaceId: "ws-1", proyectoId: "pro-1", tipo: "VHS", cassetteNumero: 2, estado: "COMPLETA", motivoFin: "NO_DIGITALIZABLE", bonificacionArs: null });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("digitalizacionAjustes", { workspaceId: "ws-1", precioNoDigitalizableArs: "2000.00" });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0099", status: "EN_CURSO", totalArs: "36000.00", items, totals: calcularTotales(items as never, null) });
  // Seña paga y saldo pendiente.
  B.agregar("fotofficePedidoCuota", { id: "sena", workspaceId: "ws-1", pedidoId: "ped-1", position: 1, dueDate: new Date("2026-11-01T00:00:00Z"), amountArs: "18000.00" });
  B.agregar("fotofficePedidoCuota", { id: "saldo", workspaceId: "ws-1", pedidoId: "ped-1", position: 2, dueDate: new Date("2026-11-30T00:00:00Z"), amountArs: "18000.00" });
  B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: "cob-1", cuotaId: "sena", amountArs: "18000.00" });
  B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1", pedidoId: "ped-1", pedidoItemIndex: 0, number: "T-1", name: "Digitalización" });
  noDigitalizable("g1");
});

describe("cassette que no se pudo digitalizar: el pedido", () => {
  it("se cobra 2.000: baja el total 10.000, sale del saldo pendiente y queda anotado en la grabación", async () => {
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" }))
      .toEqual({ estado: "APLICADA", bonificacionArs: 10000, precioArs: 2000 });
    expect(String(pedido().totalArs)).toBe("26000.00");
    expect((pedido().items as { descuento: unknown }[])[0]!.descuento).toEqual({ tipo: "MONTO", valor: 10000 });
    expect((pedido().totals as { total: number }).total).toBe(26000);
    expect(montos()).toEqual(["18000.00", "8000.00"]);
    expect(String(grabacion("g1").bonificacionArs)).toBe("10000.00");
    expect(B.datos.fotofficeProyectoNota.map((n) => n.body)).toEqual(["Cassette 2 no se pudo digitalizar: se cobra 2.000 pesos. Se descontaron 10.000 pesos del pedido."]);
  });

  it("un segundo cassette también descuenta 10.000; si el saldo queda en cero, la cuota se borra", async () => {
    await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" });
    noDigitalizable("g2");
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g2", cassette: "Cassette 3" }))
      .toMatchObject({ estado: "A_MANO", bonificacionArs: 10000 });
    // Quedaban 8.000 libres: no alcanza, no se toca nada y queda la tarea.
    expect(String(pedido().totalArs)).toBe("26000.00");
    expect(montos()).toEqual(["18000.00", "8000.00"]);
    expect(grabacion("g2").bonificacionArs).toBeNull();
    expect(tareas()).toEqual([expect.stringContaining("Cassette 3 no se pudo digitalizar: correspondía descontar 10.000 pesos")]);
  });

  it("el cliente ya pagó todo: no se toca el dinero cobrado y queda una tarea en el pedido", async () => {
    B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: "cob-2", cuotaId: "saldo", amountArs: "18000.00" });
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" })).toMatchObject({ estado: "A_MANO" });
    expect(String(pedido().totalArs)).toBe("36000.00");
    expect(montos()).toEqual(["18000.00", "18000.00"]);
    expect(tareas()).toHaveLength(1);
    // Repetirlo no duplica la tarea.
    await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" });
    expect(tareas()).toHaveLength(1);
  });

  it("sin precio configurado, pedido cancelado o trabajo sin pedido: no hace nada", async () => {
    B.datos.digitalizacionAjustes[0]!.precioNoDigitalizableArs = null;
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" })).toEqual({ estado: "NADA" });
    B.datos.digitalizacionAjustes[0]!.precioNoDigitalizableArs = "2000.00";
    pedido().status = "CANCELADO";
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" })).toEqual({ estado: "NADA" });
    expect(String(pedido().totalArs)).toBe("36000.00");
    // Otro negocio no ve este trabajo.
    pedido().status = "EN_CURSO";
    expect(await bonificarNoDigitalizable({ workspaceId: "ws-2", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" })).toEqual({ estado: "NADA" });
  });

  it("«Quitar»: los 10.000 vuelven al pedido como una cuota nueva que vence hoy, una sola vez", async () => {
    await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" });
    const ahora = new Date("2026-11-18T15:00:00.000Z");
    expect(await deshacerBonificacion({ workspaceId: "ws-1", grabacionId: "g1", cassette: "Cassette 2", ahora })).toEqual({ estado: "DEVUELTA", bonificacionArs: 10000 });
    expect(String(pedido().totalArs)).toBe("36000.00");
    expect((pedido().items as { descuento: unknown }[])[0]!.descuento).toBeNull();
    expect((pedido().totals as { total: number }).total).toBe(36000);
    expect(montos()).toEqual(["18000.00", "8000.00", "10000.00"]);
    expect((cuotas()[2]!.dueDate as Date).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(grabacion("g1").bonificacionArs).toBeNull();
    expect(await deshacerBonificacion({ workspaceId: "ws-1", grabacionId: "g1", cassette: "Cassette 2", ahora })).toEqual({ estado: "NADA" });
    expect(montos()).toHaveLength(3);
  });

  it("«Quitar» con el renglón editado a mano (ya no tiene ese descuento): no toca el pedido y deja una tarea", async () => {
    await bonificarNoDigitalizable({ workspaceId: "ws-1", proyectoId: "pro-1", grabacionId: "g1", cassette: "Cassette 2" });
    pedido().items = items;
    pedido().totals = calcularTotales(items as never, null);
    expect(await deshacerBonificacion({ workspaceId: "ws-1", grabacionId: "g1", cassette: "Cassette 2" })).toMatchObject({ estado: "A_MANO" });
    expect(String(pedido().totalArs)).toBe("26000.00");
    expect(tareas()).toEqual([expect.stringContaining("Se quitó «Cassette 2 no se pudo digitalizar»")]);
    expect(grabacion("g1").bonificacionArs).toBeNull();
  });
});
