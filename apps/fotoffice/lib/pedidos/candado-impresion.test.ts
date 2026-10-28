import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./plan", () => ({ bloquearPedido: vi.fn(), planesDe: vi.fn() }));
const { exigirPedidoPagado } = await import("./candado-saldo");

function tx(impresion: Record<string, unknown> | null) {
  return {
    fotofficeProyecto: { findFirst: vi.fn(async () => ({ pedidoId: null })) },
    fotofficePrintOrderItem: { findFirst: vi.fn(async () => (impresion ? { orderId: "ord1" } : null)) },
    fotofficePrintOrder: { findFirst: vi.fn(async () => impresion) },
  } as never;
}

describe("candado del saldo en trabajos de pedidos de impresión del bot", () => {
  it("con saldo, no deja entregar", async () => {
    const r = await exigirPedidoPagado(tx({ number: 8, totalArs: "28000", paidArs: "14000", depositArs: "14000" }), "ws", { subjectType: "PROYECTO", subjectId: "p1" });
    expect(r).toContain("debe");
    expect(r).toContain("14.000");
  });

  it("pagado entero, o un pedido de impresión común (sin seña), deja entregar", async () => {
    expect(await exigirPedidoPagado(tx({ number: 8, totalArs: "28000", paidArs: "28000", depositArs: "14000" }), "ws", { subjectType: "PROYECTO", subjectId: "p1" })).toBeNull();
    expect(await exigirPedidoPagado(tx({ number: 8, totalArs: "28000", paidArs: "0", depositArs: null }), "ws", { subjectType: "PROYECTO", subjectId: "p1" })).toBeNull();
    expect(await exigirPedidoPagado(tx(null), "ws", { subjectType: "PROYECTO", subjectId: "p1" })).toBeNull();
  });
});
