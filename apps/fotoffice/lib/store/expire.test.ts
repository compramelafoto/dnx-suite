import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La conciliación del cron: un pedido cuya retención venció se le pregunta a Mercado Pago antes
 * de darlo por vencido. Si el pago estaba aprobado (y el aviso nunca llegó), se acredita; si no,
 * pasa a EXPIRED con su evento.
 */
const h = vi.hoisted(() => {
  const tx = {
    storeOrder: { updateMany: vi.fn() },
    storeOrderEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      storeOrder: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
    resolveWorkspaceCollector: vi.fn(),
    searchPaymentsByExternalReference: vi.fn(),
    getPayment: vi.fn(),
    creditStorePayment: vi.fn(),
  };
});
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: () => ({
    searchPaymentsByExternalReference: h.searchPaymentsByExternalReference,
    getPayment: h.getPayment,
  }),
}));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: h.resolveWorkspaceCollector }));
vi.mock("./credit-payment", () => ({ creditStorePayment: h.creditStorePayment }));

const { reconcilePendingOrders } = await import("./expire");
const { checkStoreOrderPayment, isApprovedMpPayment } = await import("./mp-payment");

const now = new Date("2026-10-04T15:00:00Z");

function pago(over: { status?: string; externalReference?: string } = {}) {
  const status = over.status ?? "approved";
  return {
    providerPaymentId: "mp1",
    status: status === "approved" ? "APPROVED" : "PENDING",
    amountMinor: 25_000_00,
    currency: "ARS",
    externalReference: over.externalReference ?? "store:ord1",
    liveMode: true,
    rawSanitized: { status },
  };
}

/** Los vencidos que esperaban el pago (1ª consulta) y los ya vencidos de las últimas 48 h (2ª). */
function pedidos(pendientes: unknown[], vencidos: unknown[] = []) {
  h.prisma.storeOrder.findMany.mockImplementation(async ({ where }: { where: { status: string } }) =>
    where.status === "PENDING_PAYMENT" ? pendientes : vencidos,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resolveWorkspaceCollector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
  h.tx.storeOrder.updateMany.mockResolvedValue({ count: 1 });
  h.creditStorePayment.mockResolvedValue({ applied: true, status: "PAID" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("reconcilePendingOrders", () => {
  it("vencido sin pago en Mercado Pago: pasa a EXPIRED con su evento", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(null);

    const r = await reconcilePendingOrders({ now });

    expect(r).toEqual({ checked: 1, credited: 0, expired: 1 });
    expect(h.searchPaymentsByExternalReference).toHaveBeenCalledWith("store:ord1");
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", workspaceId: "ws1", status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED" },
    });
    expect(h.tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "ord1", fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED" }),
    });
    expect(h.creditStorePayment).not.toHaveBeenCalled();
  });

  it("vencido con un pago aprobado que el aviso no trajo: lo acredita y no lo vence", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(pago());

    const r = await reconcilePendingOrders({ now });

    expect(r).toEqual({ checked: 1, credited: 1, expired: 0 });
    expect(h.creditStorePayment).toHaveBeenCalledWith({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it("con un pago todavía pendiente (p. ej. en efectivo): vence igual; si después se aprueba, lo acredita el aviso", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(pago({ status: "pending" }));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1 });
  });

  it("si Mercado Pago no responde, no lo vence: lo intenta la próxima corrida", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockRejectedValue(new Error("timeout"));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 0 });
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it("si Mercado Pago lleva más de 48 h sin responder por ese pedido, lo vence igual", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-02T14:00:00Z") }]);
    h.searchPaymentsByExternalReference.mockRejectedValue(new Error("timeout"));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1 });
  });

  it("si la institución no tiene cobros habilitados, vence igual: no hay pago que buscar", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.resolveWorkspaceCollector.mockResolvedValue({ ok: false });
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1 });
  });

  it("los vencidos de las últimas 48 h sin pago se vuelven a consultar y, si apareció el pago, se acreditan", async () => {
    pedidos([], [{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(pago());
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 1, expired: 0 });

    const consultaVencidos = h.prisma.storeOrder.findMany.mock.calls.find(
      (c) => (c[0] as { where: { status: string } }).where.status === "EXPIRED",
    )?.[0] as { where: Record<string, unknown> };
    expect(consultaVencidos.where).toMatchObject({
      status: "EXPIRED",
      mpPaymentId: null,
      holdExpiresAt: { gte: new Date("2026-10-02T15:00:00Z") },
    });
  });

  it("busca sólo pendientes con la retención vencida, hasta el límite", async () => {
    pedidos([]);
    await reconcilePendingOrders({ now, limit: 5 });
    const consulta = h.prisma.storeOrder.findMany.mock.calls.find(
      (c) => (c[0] as { where: { status: string } }).where.status === "PENDING_PAYMENT",
    )?.[0] as { where: Record<string, unknown>; take: number };
    expect(consulta.where).toMatchObject({ status: "PENDING_PAYMENT", holdExpiresAt: { lt: now } });
    expect(consulta.take).toBe(5);
  });
});

describe("checkStoreOrderPayment", () => {
  it("un pago aprobado de OTRO pedido no acredita este", async () => {
    h.getPayment.mockResolvedValue(pago({ externalReference: "store:otro" }));
    const r = await checkStoreOrderPayment({ workspaceId: "ws1", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ outcome: "no_payment" });
    expect(h.creditStorePayment).not.toHaveBeenCalled();
  });

  it("con el payment_id de la vuelta, lee ese pago y lo acredita si está aprobado", async () => {
    h.getPayment.mockResolvedValue(pago());
    const r = await checkStoreOrderPayment({ workspaceId: "ws1", orderId: "ord1", providerPaymentId: "mp1" });
    expect(h.getPayment).toHaveBeenCalledWith("mp1");
    expect(r).toMatchObject({ outcome: "credited" });
  });
});

describe("isApprovedMpPayment", () => {
  it("manda el estado crudo de Mercado Pago; si no está, el normalizado", () => {
    expect(isApprovedMpPayment({ status: "APPROVED", rawSanitized: { status: "approved" } })).toBe(true);
    expect(isApprovedMpPayment({ status: "PENDING", rawSanitized: { status: "in_process" } })).toBe(false);
    expect(isApprovedMpPayment({ status: "APPROVED", rawSanitized: {} })).toBe(true);
  });
});
