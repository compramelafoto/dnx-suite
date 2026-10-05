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
      storeOrder: { findMany: vi.fn(), findFirst: vi.fn() },
      storeOrderEvent: { create: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
    resolveWorkspaceCollector: vi.fn(),
    searchPaymentsByExternalReference: vi.fn(),
    getPayment: vi.fn(),
    creditStorePayment: vi.fn(),
    sendCreditFailureAlert: vi.fn(),
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
vi.mock("./emails", () => ({ sendCreditFailureAlert: h.sendCreditFailureAlert }));

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
    rawSanitized: { status, date_approved: "2026-10-04T11:58:00.000-03:00" },
  };
}

type ConsultaPedidos = { where: { status: string; events?: { none?: unknown; some?: unknown } }; take: number };

/**
 * Los vencidos que esperaban el pago y los ya vencidos de las últimas 48 h. Los que esperaban se
 * piden en dos tandas: los que nunca fallaron (`events.none`) y los reintentos de un pago que no
 * se pudo acreditar (`events.some`, `conFallo`). Cada tanda respeta su `take`, como la base.
 */
function pedidos(pendientes: unknown[], vencidos: unknown[] = [], conFallo: unknown[] = []) {
  h.prisma.storeOrder.findMany.mockImplementation(async ({ where, take }: ConsultaPedidos) => {
    if (where.status !== "PENDING_PAYMENT") return vencidos.slice(0, take);
    if (where.events?.some) return conFallo.slice(0, take);
    if (where.events?.none) return pendientes.slice(0, take);
    // Una consulta sin filtrar por fallo ve todos, los más viejos primero (como `orderBy`).
    const porVencimiento = (x: unknown) => (x as { holdExpiresAt: Date }).holdExpiresAt.getTime();
    return [...conFallo, ...pendientes].sort((a, b) => porVencimiento(a) - porVencimiento(b)).slice(0, take);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resolveWorkspaceCollector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
  h.tx.storeOrder.updateMany.mockResolvedValue({ count: 1 });
  h.creditStorePayment.mockResolvedValue({ applied: true, status: "PAID" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reconcilePendingOrders", () => {
  it("vencido sin pago en Mercado Pago: pasa a EXPIRED con su evento", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(null);

    const r = await reconcilePendingOrders({ now });

    expect(r).toEqual({ checked: 1, credited: 0, expired: 1, failed: 0 });
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

    expect(r).toEqual({ checked: 1, credited: 1, expired: 0, failed: 0 });
    expect(h.creditStorePayment).toHaveBeenCalledWith({
      orderId: "ord1",
      providerPaymentId: "mp1",
      amountMinor: 25_000_00,
      currency: "ARS",
      paidAt: new Date("2026-10-04T14:58:00Z"),
    });
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it("con un pago todavía pendiente (p. ej. en efectivo): vence igual; si después se aprueba, lo acredita el aviso", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(pago({ status: "pending" }));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1, failed: 0 });
  });

  it("si Mercado Pago no responde, no lo vence: lo intenta la próxima corrida", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockRejectedValue(new Error("timeout"));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 0, failed: 0 });
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it("si Mercado Pago lleva más de 48 h sin responder por ese pedido, lo vence igual", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-02T14:00:00Z") }]);
    h.searchPaymentsByExternalReference.mockRejectedValue(new Error("timeout"));
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1, failed: 0 });
  });

  it("si la institución no tiene cobros habilitados, vence igual: no hay pago que buscar", async () => {
    pedidos([{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.resolveWorkspaceCollector.mockResolvedValue({ ok: false });
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 0, expired: 1, failed: 0 });
  });

  it("los vencidos de las últimas 48 h sin pago se vuelven a consultar y, si apareció el pago, se acreditan", async () => {
    pedidos([], [{ id: "ord1", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }]);
    h.searchPaymentsByExternalReference.mockResolvedValue(pago());
    const r = await reconcilePendingOrders({ now });
    expect(r).toEqual({ checked: 1, credited: 1, expired: 0, failed: 0 });

    const consultaVencidos = h.prisma.storeOrder.findMany.mock.calls.find(
      (c) => (c[0] as { where: { status: string } }).where.status === "EXPIRED",
    )?.[0] as { where: Record<string, unknown> };
    expect(consultaVencidos.where).toMatchObject({
      status: "EXPIRED",
      mpPaymentId: null,
      holdExpiresAt: { gte: new Date("2026-10-02T15:00:00Z") },
    });
    // Los más recientes primero.
    expect((consultaVencidos as unknown as { orderBy: unknown }).orderBy).toEqual({ updatedAt: "desc" });
  });

  it("un pedido que falla no frena a los demás", async () => {
    const hold = new Date("2026-10-04T14:50:00Z");
    pedidos([
      { id: "ord1", workspaceId: "ws1", holdExpiresAt: hold },
      { id: "ord2", workspaceId: "ws1", holdExpiresAt: hold },
    ]);
    h.resolveWorkspaceCollector.mockRejectedValueOnce(new Error("base caída"));
    h.searchPaymentsByExternalReference.mockResolvedValue(null);

    const r = await reconcilePendingOrders({ now });

    expect(r).toEqual({ checked: 2, credited: 0, expired: 1, failed: 1 });
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "ord2" }) }),
    );
  });

  it("un pago aprobado que no se puede acreditar: no se vence, se anota UNA vez y se alerta", async () => {
    const hold = new Date("2026-10-04T14:50:00Z");
    pedidos([
      { id: "ord1", workspaceId: "ws1", holdExpiresAt: hold },
      { id: "ord2", workspaceId: "ws1", holdExpiresAt: hold },
    ]);
    h.searchPaymentsByExternalReference.mockImplementation(async (ref: string) =>
      pago({ externalReference: ref }),
    );
    h.creditStorePayment.mockImplementation(async ({ orderId }: { orderId: string }) => {
      if (orderId === "ord1") throw new Error("se rompió");
      return { applied: true, status: "PAID" };
    });
    h.prisma.storeOrder.findFirst.mockResolvedValue({ status: "PENDING_PAYMENT", events: [{ note: "Pedido creado" }] });

    const r = await reconcilePendingOrders({ now });

    expect(r).toEqual({ checked: 2, credited: 1, expired: 0, failed: 1 });
    expect(h.tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(h.prisma.storeOrderEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: "ord1",
        fromStatus: "PENDING_PAYMENT",
        toStatus: "PENDING_PAYMENT",
        note: "Pago aprobado que no se pudo acreditar: revisar",
      },
    });
    expect(h.sendCreditFailureAlert).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });

    // Próxima corrida: el último evento ya lo dice, no se repite la constancia ni la alerta.
    vi.clearAllMocks();
    h.resolveWorkspaceCollector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
    h.prisma.storeOrder.findFirst.mockResolvedValue({
      status: "PENDING_PAYMENT",
      events: [{ note: "Pago aprobado que no se pudo acreditar: revisar" }],
    });
    await reconcilePendingOrders({ now });
    expect(h.prisma.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.sendCreditFailureAlert).not.toHaveBeenCalled();
  });

  it("tantos atascados (pago que no se pudo acreditar) como el límite no frenan a un vencido nuevo", async () => {
    const viejo = new Date("2026-10-01T10:00:00Z");
    const atascados = Array.from({ length: 3 }, (_, i) => ({ id: `fallo${i}`, workspaceId: "ws1", holdExpiresAt: viejo }));
    pedidos([{ id: "nuevo", workspaceId: "ws1", holdExpiresAt: new Date("2026-10-04T14:50:00Z") }], [], atascados);
    h.searchPaymentsByExternalReference.mockResolvedValue(null);

    // Límite chico (3) en lugar de 100: hay tantos atascados como el límite.
    const r = await reconcilePendingOrders({ now, limit: 3 });

    expect(h.searchPaymentsByExternalReference).toHaveBeenCalledWith("store:nuevo");
    expect(h.tx.storeOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "nuevo" }) }),
    );
    // Con el lugar que sobra (2) se reintentan los atascados más viejos.
    expect(r.checked).toBe(3);
    const consultas = h.prisma.storeOrder.findMany.mock.calls.map((c) => c[0] as ConsultaPedidos);
    const deReintento = consultas.find((c) => c.where.events?.some);
    expect(deReintento?.take).toBe(2);
    expect(consultas.find((c) => c.where.events?.none)).toMatchObject({
      where: { events: { none: { note: { startsWith: "Pago aprobado que no se pudo acreditar" } } } },
      take: 3,
    });
  });

  it("si los nuevos llenan el límite, esa corrida no pide reintentos", async () => {
    const hold = new Date("2026-10-04T14:50:00Z");
    pedidos(
      [
        { id: "a", workspaceId: "ws1", holdExpiresAt: hold },
        { id: "b", workspaceId: "ws1", holdExpiresAt: hold },
      ],
      [],
      [{ id: "fallo", workspaceId: "ws1", holdExpiresAt: hold }],
    );
    h.searchPaymentsByExternalReference.mockResolvedValue(null);

    await reconcilePendingOrders({ now, limit: 2 });

    const consultas = h.prisma.storeOrder.findMany.mock.calls.map((c) => c[0] as ConsultaPedidos);
    expect(consultas.some((c) => c.where.events?.some)).toBe(false);
    expect(h.searchPaymentsByExternalReference).not.toHaveBeenCalledWith("store:fallo");
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

describe("storePaymentFacts", () => {
  it("toma monto, moneda y la fecha de aprobación; sin fecha, null", async () => {
    const { storePaymentFacts } = await import("./mp-payment");
    expect(storePaymentFacts(pago())).toEqual({
      providerPaymentId: "mp1",
      amountMinor: 25_000_00,
      currency: "ARS",
      paidAt: new Date("2026-10-04T14:58:00Z"),
    });
    expect(storePaymentFacts({ ...pago(), rawSanitized: { status: "approved" } }).paidAt).toBeNull();
    expect(storePaymentFacts({ ...pago(), rawSanitized: { date_approved: "cualquiera" } }).paidAt).toBeNull();
  });
});

describe("isApprovedMpPayment", () => {
  it("manda el estado crudo de Mercado Pago; si no está, el normalizado", () => {
    expect(isApprovedMpPayment({ status: "APPROVED", rawSanitized: { status: "approved" } })).toBe(true);
    expect(isApprovedMpPayment({ status: "PENDING", rawSanitized: { status: "in_process" } })).toBe(false);
    expect(isApprovedMpPayment({ status: "APPROVED", rawSanitized: {} })).toBe(true);
  });
});
