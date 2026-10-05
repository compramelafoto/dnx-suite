import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los cambios de estado que hace el personal desde el panel. Con un `tx` falso (el molde de
 * `credit-payment.test.ts`): se mira QUÉ se escribe, en qué orden y qué se anula.
 */
const h = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    storeOrder: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  },
  voidSale: vi.fn(),
  finalizePaidOrder: vi.fn(),
  lockAndCheckOrderStock: vi.fn(),
  emails: {
    sendOrderPaidEmail: vi.fn(),
    sendNewOrderNotice: vi.fn(),
    sendPaidNoStockAlert: vi.fn(),
    sendDuplicatePaymentAlert: vi.fn(),
    sendOrderReadyEmail: vi.fn(),
    sendCreditFailureAlert: vi.fn(),
  },
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/sales/void-sale", () => ({ voidSale: h.voidSale }));
vi.mock("./credit-payment", () => ({
  finalizePaidOrder: h.finalizePaidOrder,
  lockAndCheckOrderStock: h.lockAndCheckOrderStock,
  SELECT_PEDIDO_A_ACREDITAR: { id: true },
}));
vi.mock("./emails", () => h.emails);

const { changeOrderStatus, markOrderReviewed, isProblemOrder, staffTargets, cancelNeedsNote, listStoreOrders } = await import(
  "./order-admin"
);

type Status = "PENDING_PAYMENT" | "PAID" | "READY" | "DELIVERED" | "CANCELLED" | "EXPIRED" | "PAID_NO_STOCK";

function pedido(status: Status, over: { saleId?: string | null; paidAt?: Date | null } = {}) {
  return {
    id: "ord1",
    workspaceId: "ws1",
    orderNumber: 7,
    status,
    mpPaymentId: status === "PENDING_PAYMENT" ? null : "mp1",
    saleId: over.saleId === undefined ? (status === "PAID" || status === "READY" ? "sale1" : null) : over.saleId,
    paidAt: over.paidAt === undefined ? new Date("2026-10-04T15:00:00Z") : over.paidAt,
    buyerName: "Ana Pérez",
    buyerEmail: "ana@example.com",
    buyerPhone: null,
    totalArs: "25000.00",
    feeArs: "0",
    feeBps: 0,
    items: [{ productId: "p1", variantId: null, productName: "Taza", variantName: null, qty: 1, unitPriceArs: "25000.00" }],
  };
}

function crearTx(order: ReturnType<typeof pedido> | null, ultimaSinStock: string | null = null) {
  return {
    sale: { findFirst: vi.fn(async (): Promise<{ status: string } | null> => ({ status: "COMPLETADA" })) },
    $queryRaw: vi.fn(async () => []),
    storeOrder: {
      findFirst: vi.fn(async () => order),
      updateMany: vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 })),
    },
    storeOrderEvent: {
      create: vi.fn<(args: unknown) => Promise<object>>(async () => ({})),
      findFirst: vi.fn(async () => (ultimaSinStock === null ? null : { note: ultimaSinStock })),
    },
  };
}

let tx: ReturnType<typeof crearTx>;

function preparar(order: ReturnType<typeof pedido> | null, ultimaSinStock: string | null = null) {
  tx = crearTx(order, ultimaSinStock);
  h.prisma.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
}

const base = { workspaceId: "ws1", orderId: "ord1", userId: 42 };

beforeEach(() => {
  vi.clearAllMocks();
  h.voidSale.mockResolvedValue({ ok: true, saleNumber: 99 });
  h.finalizePaidOrder.mockResolvedValue({ saleId: "sale2", saleNumber: 100 });
  h.lockAndCheckOrderStock.mockResolvedValue(true);
});

function datosDelUpdate() {
  return (tx.storeOrder.updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
}
function datosDelEvento() {
  return (tx.storeOrderEvent.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
}

describe("changeOrderStatus — bloqueo y validación", () => {
  it("bloquea el pedido ANTES de leer su estado, con el workspace", async () => {
    preparar(pedido("PAID"));
    await changeOrderStatus({ ...base, to: "READY", note: null });
    const lock = tx.$queryRaw.mock.invocationCallOrder[0]!;
    const lectura = tx.storeOrder.findFirst.mock.invocationCallOrder[0]!;
    expect(lock).toBeLessThan(lectura);
    expect(tx.storeOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ord1", workspaceId: "ws1" } }),
    );
  });

  it("un pedido de otra institución (o inexistente) no se toca", async () => {
    preparar(null);
    const r = await changeOrderStatus({ ...base, to: "READY", note: null });
    expect(r).toEqual({ ok: false, error: "Ese pedido no existe." });
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["PENDING_PAYMENT", "PAID"],
    ["PENDING_PAYMENT", "READY"],
    ["DELIVERED", "CANCELLED"],
    ["CANCELLED", "PAID"],
    ["EXPIRED", "CANCELLED"],
    ["READY", "PAID"],
  ] as const)("no deja pasar de %s a %s", async (from, to) => {
    preparar(pedido(from));
    const r = await changeOrderStatus({ ...base, to, note: "x" });
    expect(r.ok).toBe(false);
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.voidSale).not.toHaveBeenCalled();
  });

  it("el estado se relee dentro de la transacción: si ya cambió, no se pisa", async () => {
    // La pantalla mostraba PAID, pero otro miembro ya lo entregó.
    preparar(pedido("DELIVERED"));
    const r = await changeOrderStatus({ ...base, to: "READY", note: null });
    expect(r.ok).toBe(false);
  });
});

describe("changeOrderStatus — preparar y entregar", () => {
  it("READY marca la fecha, deja evento con quién y avisa al comprador DESPUÉS de confirmar", async () => {
    preparar(pedido("PAID"));
    h.emails.sendOrderReadyEmail.mockImplementation(async () => {
      expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    });
    const r = await changeOrderStatus({ ...base, to: "READY", note: null });
    expect(r).toEqual({ ok: true });
    expect(datosDelUpdate()).toMatchObject({ status: "READY", readyAt: expect.any(Date) });
    expect(datosDelEvento()).toMatchObject({ orderId: "ord1", fromStatus: "PAID", toStatus: "READY", actorUserId: 42 });
    expect(h.emails.sendOrderReadyEmail).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
  });

  it("DELIVERED marca la fecha de entrega y no manda correos", async () => {
    preparar(pedido("READY"));
    const r = await changeOrderStatus({ ...base, to: "DELIVERED", note: "Retiró la hermana" });
    expect(r).toEqual({ ok: true });
    expect(datosDelUpdate()).toMatchObject({ status: "DELIVERED", deliveredAt: expect.any(Date) });
    expect(datosDelEvento()).toMatchObject({ note: "Retiró la hermana", actorUserId: 42 });
    expect(h.emails.sendOrderReadyEmail).not.toHaveBeenCalled();
  });

  it("si la transacción falla, no sale ningún correo", async () => {
    preparar(pedido("PAID"));
    tx.storeOrderEvent.create.mockRejectedValueOnce(new Error("se cayó la base"));
    const r = await changeOrderStatus({ ...base, to: "READY", note: null });
    expect(r.ok).toBe(false);
    expect(h.emails.sendOrderReadyEmail).not.toHaveBeenCalled();
  });
});

describe("changeOrderStatus — cancelar", () => {
  it("cancelar un pedido pagado sin nota → error, sin tocar nada", async () => {
    preparar(pedido("PAID"));
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: "   " });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Escribí") });
    expect(h.voidSale).not.toHaveBeenCalled();
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
  });

  it("cancelar un pedido pagado anula su venta en la misma transacción, sin borrar el pago", async () => {
    preparar(pedido("READY"));
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: "No lo vino a buscar" });
    expect(r).toEqual({ ok: true });
    expect(h.voidSale).toHaveBeenCalledWith(tx, {
      workspaceId: "ws1",
      saleId: "sale1",
      reason: "Pedido online #7 cancelado: No lo vino a buscar",
      userId: 42,
      fromStoreOrder: true,
    });
    expect(tx.sale.findFirst).toHaveBeenCalledWith({ where: { id: "sale1", workspaceId: "ws1" }, select: { status: true } });
    const data = datosDelUpdate();
    expect(data).toMatchObject({ status: "CANCELLED", cancelledAt: expect.any(Date) });
    expect(data).not.toHaveProperty("mpPaymentId");
    expect(datosDelEvento()).toMatchObject({ fromStatus: "READY", toStatus: "CANCELLED", actorUserId: 42 });
  });

  it("si la venta no se puede anular, se aborta y el pedido sigue igual", async () => {
    preparar(pedido("PAID"));
    h.voidSale.mockResolvedValue({ ok: false, error: "Esa venta ya está anulada." });
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: "Se arrepintió" });
    expect(r).toEqual({ ok: false, error: "Esa venta ya está anulada." });
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
  });

  it("si la venta ya estaba anulada, cancela igual sin volver a anularla", async () => {
    preparar(pedido("PAID"));
    tx.sale.findFirst.mockResolvedValue({ status: "ANULADA" });
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: "Ya se había anulado la venta" });
    expect(r).toEqual({ ok: true });
    expect(h.voidSale).not.toHaveBeenCalled();
    expect(datosDelUpdate()).toMatchObject({ status: "CANCELLED" });
    expect(datosDelEvento()).toMatchObject({ fromStatus: "PAID", toStatus: "CANCELLED" });
  });

  it("cancelar un pedido pagado sin stock exige nota y no anula nada (no hay venta)", async () => {
    preparar(pedido("PAID_NO_STOCK"));
    expect((await changeOrderStatus({ ...base, to: "CANCELLED", note: null })).ok).toBe(false);
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: "Devuelto en MP" });
    expect(r).toEqual({ ok: true });
    expect(h.voidSale).not.toHaveBeenCalled();
    expect(datosDelUpdate()).toMatchObject({ status: "CANCELLED" });
  });

  it("cancelar un pedido que espera el pago no pide nota: sólo libera la reserva", async () => {
    preparar(pedido("PENDING_PAYMENT"));
    const r = await changeOrderStatus({ ...base, to: "CANCELLED", note: null });
    expect(r).toEqual({ ok: true });
    expect(h.voidSale).not.toHaveBeenCalled();
    expect(datosDelUpdate()).toMatchObject({ status: "CANCELLED", holdExpiresAt: null });
  });
});

describe("changeOrderStatus — reponer stock (PAID_NO_STOCK → PAID)", () => {
  it("con stock: crea la venta con finalizePaidOrder y avisa al comprador", async () => {
    const order = pedido("PAID_NO_STOCK");
    preparar(order, "Pago mp1 aprobado sin stock suficiente");
    const r = await changeOrderStatus({ ...base, to: "PAID", note: null });
    expect(r).toEqual({ ok: true });
    expect(h.lockAndCheckOrderStock).toHaveBeenCalledWith(tx, order);
    expect(h.finalizePaidOrder).toHaveBeenCalledWith(
      tx,
      order,
      order.paidAt,
      expect.objectContaining({ actorUserId: 42 }),
    );
    // El stock se bloquea después del pedido.
    expect(tx.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(h.lockAndCheckOrderStock.mock.invocationCallOrder[0]!);
    expect(h.emails.sendOrderPaidEmail).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
  });

  it("sin stock suficiente: no crea venta", async () => {
    preparar(pedido("PAID_NO_STOCK"), "Pago mp1 aprobado sin stock suficiente");
    h.lockAndCheckOrderStock.mockResolvedValue(false);
    const r = await changeOrderStatus({ ...base, to: "PAID", note: null });
    expect(r).toEqual({ ok: false, error: "Todavía no hay stock suficiente." });
    expect(h.finalizePaidOrder).not.toHaveBeenCalled();
    expect(h.emails.sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  it("si se cobró un monto distinto, no se puede dar por pagado: hay que devolver", async () => {
    preparar(pedido("PAID_NO_STOCK"), "Pago con monto distinto: revisar");
    const r = await changeOrderStatus({ ...base, to: "PAID", note: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("devolv");
    expect(h.lockAndCheckOrderStock).not.toHaveBeenCalled();
    expect(h.finalizePaidOrder).not.toHaveBeenCalled();
  });
});

describe("markOrderReviewed", () => {
  it("deja una nota del personal sin cambiar el estado", async () => {
    preparar(pedido("PAID"));
    const r = await markOrderReviewed({ ...base, note: "Ya devolví el segundo pago" });
    expect(r).toEqual({ ok: true });
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(datosDelEvento()).toMatchObject({
      fromStatus: "PAID",
      toStatus: "PAID",
      actorUserId: 42,
      note: "Revisado: Ya devolví el segundo pago",
    });
  });

  it("sin nota no se marca", async () => {
    preparar(pedido("PAID"));
    expect((await markOrderReviewed({ ...base, note: "" })).ok).toBe(false);
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
  });
});

describe("reglas puras del panel", () => {
  const sistema = (note: string) => ({ note, actorUserId: null });
  const persona = (note: string) => ({ note, actorUserId: 42 });
  const DUP = "Pago duplicado mp2: hay que devolverlo";
  const FALLO = "Pago aprobado que no se pudo acreditar: revisar";

  it("problemas: sin stock, pago duplicado o pago que no se pudo acreditar", () => {
    expect(isProblemOrder({ status: "PAID_NO_STOCK", events: [] })).toBe(true);
    expect(isProblemOrder({ status: "PAID", events: [sistema(DUP)] })).toBe(true);
    expect(isProblemOrder({ status: "PENDING_PAYMENT", events: [sistema(FALLO)] })).toBe(true);
    expect(isProblemOrder({ status: "PAID", events: [sistema("Venta #3 registrada")] })).toBe(false);
  });

  it("preparar o entregar después del problema NO lo resuelve", () => {
    const events = [sistema(DUP), persona("Pedido listo"), { note: null, actorUserId: 42 }];
    expect(isProblemOrder({ status: "DELIVERED", events })).toBe(true);
  });

  it("sólo lo resuelve un 'Revisado:' de una persona POSTERIOR al último problema", () => {
    expect(isProblemOrder({ status: "PAID", events: [sistema(DUP), persona("Revisado: devuelto")] })).toBe(false);
    // Revisado antes de un segundo duplicado: vuelve a ser problema.
    expect(isProblemOrder({ status: "PAID", events: [sistema(DUP), persona("Revisado: ok"), sistema(DUP)] })).toBe(true);
    // Un "Revisado:" sin persona no cuenta.
    expect(isProblemOrder({ status: "PAID", events: [sistema(DUP), sistema("Revisado: x")] })).toBe(true);
    // Sin stock sigue siendo problema aunque se haya anotado como revisado.
    expect(isProblemOrder({ status: "PAID_NO_STOCK", events: [persona("Revisado: x")] })).toBe(true);
  });

  it("un arrepentimiento del comprador es problema hasta que una persona lo marque revisado", () => {
    const ARREPENTIMIENTO = "Arrepentimiento solicitado: me equivoqué de talle";
    expect(isProblemOrder({ status: "PAID", events: [sistema("Arrepentimiento solicitado")] })).toBe(true);
    expect(isProblemOrder({ status: "DELIVERED", events: [sistema(ARREPENTIMIENTO)] })).toBe(true);
    expect(isProblemOrder({ status: "PAID", events: [sistema(ARREPENTIMIENTO), persona("Revisado: devuelto")] })).toBe(
      false,
    );
    expect(isProblemOrder({ status: "PAID", events: [persona("Revisado: x"), sistema(ARREPENTIMIENTO)] })).toBe(true);
  });

  it("botones: los de canTransition, sin PAID cuando el monto no coincide", () => {
    expect(staffTargets("PAID", { amountMismatch: false })).toEqual(["READY", "DELIVERED", "CANCELLED"]);
    expect(staffTargets("PAID_NO_STOCK", { amountMismatch: false })).toEqual(["PAID", "CANCELLED"]);
    expect(staffTargets("PAID_NO_STOCK", { amountMismatch: true })).toEqual(["CANCELLED"]);
    expect(staffTargets("DELIVERED", { amountMismatch: false })).toEqual([]);
  });

  it("cancelar pide nota sólo si entró plata", () => {
    expect(cancelNeedsNote("PAID")).toBe(true);
    expect(cancelNeedsNote("READY")).toBe(true);
    expect(cancelNeedsNote("PAID_NO_STOCK")).toBe(true);
    expect(cancelNeedsNote("PENDING_PAYMENT")).toBe(false);
  });
});

describe("listStoreOrders — pestaña Problemas", () => {
  it("busca candidatos también por arrepentimiento, y los cuenta como problema", async () => {
    h.prisma.storeOrder.findMany
      // 1) candidatos a problema
      .mockResolvedValueOnce([
        { id: "ordA", status: "PAID", events: [{ note: "Arrepentimiento solicitado", actorUserId: null }] },
        {
          id: "ordB",
          status: "DELIVERED",
          events: [
            { note: "Arrepentimiento solicitado: no lo quiero", actorUserId: null },
            { note: "Revisado: ya devuelto", actorUserId: 42 },
          ],
        },
      ])
      // 2) filas de la pestaña
      .mockResolvedValueOnce([]);
    h.prisma.storeOrder.groupBy.mockResolvedValue([]);
    h.prisma.storeOrder.count.mockResolvedValue(2);

    const r = await listStoreOrders("ws1", "problemas");

    const consulta = h.prisma.storeOrder.findMany.mock.calls[0]![0] as {
      where: { workspaceId: string; OR: [unknown, { events: { some: { OR: unknown[] } } }] };
      select: { events: { where: { OR: unknown[] } } };
    };
    expect(consulta.where.workspaceId).toBe("ws1");
    expect(consulta.where.OR[1].events.some.OR).toContainEqual({ note: { startsWith: "Arrepentimiento solicitado" } });
    expect(consulta.select.events.where.OR).toContainEqual({ note: { startsWith: "Arrepentimiento solicitado" } });
    expect(r.counts.problemas).toBe(1);
    expect(h.prisma.storeOrder.findMany.mock.calls[1]![0]).toMatchObject({
      where: { workspaceId: "ws1", id: { in: ["ordA"] } },
    });
  });
});
