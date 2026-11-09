import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindMany = vi.fn();
const emailQueueFindMany = vi.fn();
const adminMessageCreate = vi.fn();
const queueOrderConfirmationEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: (...a: unknown[]) => orderFindMany(...a) },
    emailQueue: { findMany: (...a: unknown[]) => emailQueueFindMany(...a) },
    adminSystemMessage: { create: (...a: unknown[]) => adminMessageCreate(...a) },
  },
}));
vi.mock("@/lib/order-confirmation-email", () => ({
  queueOrderConfirmationEmail: (...a: unknown[]) => queueOrderConfirmationEmail(...a),
}));
const encolarComprobanteGrupo = vi.fn();
vi.mock("@/lib/split-1n-carrito-evento/correo", () => ({
  encolarComprobanteGrupo: (...a: unknown[]) => encolarComprobanteGrupo(...a),
}));

import { runReencolarConfirmacionesPedido } from "./reencolar-confirmaciones-pedido";

const now = new Date("2026-10-23T15:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  queueOrderConfirmationEmail.mockResolvedValue(undefined);
});

describe("runReencolarConfirmacionesPedido", () => {
  it("busca sólo pagados reales de los últimos 3 días con 15 minutos de margen, salvo preventas sin fotos", async () => {
    orderFindMany.mockResolvedValue([]);
    await runReencolarConfirmacionesPedido({ now });

    const { where } = orderFindMany.mock.calls[0][0];
    expect(where.status).toBe("PAID");
    expect(where.isTest).toBe(false);
    expect(where.createdAt.gte).toEqual(new Date("2026-10-20T15:00:00.000Z"));
    expect(where.createdAt.lte).toEqual(new Date("2026-10-23T14:45:00.000Z"));
    expect(where.OR).toEqual([{ origin: { not: "PREVENTA_PACK" } }, { items: { some: {} } }]);
    expect(emailQueueFindMany).not.toHaveBeenCalled();
  });

  it("vuelve a encolar sólo los pedidos sin comprobante y deja aviso al admin", async () => {
    orderFindMany.mockResolvedValue([{ id: 3791 }, { id: 3792 }, { id: 3800 }]);
    emailQueueFindMany.mockResolvedValue([{ idempotencyKey: "order_confirmed_album_3792" }]);

    const result = await runReencolarConfirmacionesPedido({ now });

    expect(result.faltantes).toEqual([3791, 3800]);
    expect(result.reencolados).toBe(2);
    expect(queueOrderConfirmationEmail.mock.calls).toEqual([[3791], [3800]]);
    expect(adminMessageCreate).toHaveBeenCalledTimes(1);
    expect(adminMessageCreate.mock.calls[0][0].data.body).toContain("3791, 3800");
  });

  it("si todos tienen comprobante no encola ni avisa", async () => {
    orderFindMany.mockResolvedValue([{ id: 10 }]);
    emailQueueFindMany.mockResolvedValue([{ idempotencyKey: "order_confirmed_album_10" }]);

    const result = await runReencolarConfirmacionesPedido({ now });

    expect(result.faltantes).toEqual([]);
    expect(queueOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(adminMessageCreate).not.toHaveBeenCalled();
  });

  it("en simulación sólo informa los faltantes", async () => {
    orderFindMany.mockResolvedValue([{ id: 5 }]);
    emailQueueFindMany.mockResolvedValue([]);

    const result = await runReencolarConfirmacionesPedido({ now, dryRun: true });

    expect(result.faltantes).toEqual([5]);
    expect(queueOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(adminMessageCreate).not.toHaveBeenCalled();
  });

  it("un pedido que falla no frena a los demás", async () => {
    orderFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    emailQueueFindMany.mockResolvedValue([]);
    queueOrderConfirmationEmail.mockRejectedValueOnce(new Error("db caída"));

    const result = await runReencolarConfirmacionesPedido({ now });

    expect(result.fallidos).toBe(1);
    expect(result.reencolados).toBe(1);
    expect(queueOrderConfirmationEmail).toHaveBeenCalledTimes(2);
  });

  it("carrito de evento: un solo comprobante por grupo, nunca uno por pedido", async () => {
    const grupoId = "3f2b8c1e-9a4d-4e6b-8f1a-2c3d4e5f6a7b";
    const snapshot = { split1nGrupo: { v: 1, grupoId, pedidos: [20, 21], estado: "PAGADO" } };
    orderFindMany.mockResolvedValue([
      { id: 20, pricingSnapshot: snapshot },
      { id: 21, pricingSnapshot: snapshot },
      { id: 22, pricingSnapshot: {} },
    ]);
    emailQueueFindMany.mockResolvedValue([{ idempotencyKey: "order_confirmed_album_22" }]);
    encolarComprobanteGrupo.mockResolvedValue(true);

    const result = await runReencolarConfirmacionesPedido({ now });

    expect(result.faltantes).toEqual([]);
    expect(result.gruposFaltantes).toEqual([grupoId]);
    expect(queueOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(encolarComprobanteGrupo.mock.calls).toEqual([[grupoId]]);
    expect(result.reencolados).toBe(1);
  });
});
