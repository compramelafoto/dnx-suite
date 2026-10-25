import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const E = await import("./espera-pago");

function pedido(id: string, cuotas: number[], status = "CONFIRMADO") {
  B.agregar("fotofficePedido", { id, workspaceId: "ws-1", number: `P-${id}`, clientId: "cli-1", status, totalArs: cuotas.reduce((s, x) => s + x, 0), items: [], totals: {} });
  cuotas.forEach((m, i) =>
    B.agregar("fotofficePedidoCuota", { id: `${id}-c${i + 1}`, workspaceId: "ws-1", pedidoId: id, position: i + 1, dueDate: new Date("2026-10-15T00:00:00.000Z"), amountArs: m }),
  );
}
const ajustes = (montoUnico: boolean, alias: string | null = "dnx.estudio.mp") =>
  B.agregar("fotofficeCobroAjustes", { workspaceId: "ws-1", autoConfirmarPedido: false, alias, cbuCvu: null, titular: "Daniel", cuit: null, banco: null, montoUnico });

beforeEach(() => B.vaciar());

describe("monto único", () => {
  it("el menor de 1 a 99 pesos que no repite otra espera abierta", () => {
    expect(E.montoUnicoLibre(100_000, new Set())).toBe(100_001);
    expect(E.montoUnicoLibre(100_000, new Set([100_001, 100_002]))).toBe(100_003);
    const todos = new Set(Array.from({ length: 99 }, (_, i) => 100_000 + i + 1));
    expect(E.montoUnicoLibre(100_000, todos)).toBeNull();
  });
});

describe("esperar una transferencia", () => {
  it("sin datos de transferencia no se ofrece", async () => {
    pedido("p1", [300_000]);
    ajustes(false, null);
    expect(await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c1" })).toEqual({ ok: false, error: E.MENSAJES_ESPERA.sinDatos });
  });

  it("espera el saldo de la cuota; con monto único le suma pesos sin repetir", async () => {
    pedido("p1", [300_000]);
    pedido("p2", [300_000]);
    ajustes(true);
    const a = await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c1" });
    const b = await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p2", cuotaId: "p2-c1" });
    expect(a).toEqual({ ok: true, importe: 300_000, importeAPagar: 300_001 });
    expect(b).toEqual({ ok: true, importe: 300_000, importeAPagar: 300_002 });
    expect(B.datos.fotofficeEsperaPago.map((x) => x.estado)).toEqual(["ESPERANDO", "ESPERANDO"]);
  });

  it("una sola espera abierta por cuota: la segunda devuelve la misma", async () => {
    pedido("p1", [300_000]);
    ajustes(false);
    const a = await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c1" });
    const b = await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c1" });
    expect(a).toEqual({ ok: true, importe: 300_000, importeAPagar: 300_000 });
    expect(b).toEqual(a);
    expect(B.datos.fotofficeEsperaPago).toHaveLength(1);
  });

  it("cuota de otro pedido, pedido cancelado o cuota paga: no", async () => {
    pedido("p1", [300_000]);
    pedido("p9", [100_000], "CANCELADO");
    ajustes(false);
    expect(await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p9-c1" })).toEqual({ ok: false, error: E.MENSAJES_ESPERA.noExiste });
    expect(await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p9", cuotaId: "p9-c1" })).toEqual({ ok: false, error: E.MENSAJES_ESPERA.cancelado });
    B.agregar("fotofficeCobro", { id: "co1", workspaceId: "ws-1", pedidoId: "p1", clientId: "cli-1", paidAt: new Date(), method: "EFECTIVO", amountArs: 300_000, receiptNumber: "R1", receiptTokenHash: "h1", voidedAt: null });
    B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: "co1", cuotaId: "p1-c1", amountArs: 300_000 });
    expect(await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c1" })).toEqual({ ok: false, error: E.MENSAJES_ESPERA.sinSaldo });
  });

  it("las esperas abiertas de un pedido, por cuota", async () => {
    pedido("p1", [300_000, 200_000]);
    ajustes(true);
    await E.esperarTransferencia({ workspaceId: "ws-1", pedidoId: "p1", cuotaId: "p1-c2" });
    expect(await E.esperasAbiertas("ws-1", "p1")).toEqual(new Map([["p1-c2", 200_001]]));
  });
});
