import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Acreditar un pago de la tienda es donde la plata se vuelve una venta. Se prueba con un `tx`
 * falso (el molde de `lib/sales/record-sale.test.ts`): sin Postgres, mirando QUÉ se escribe y
 * cuántas veces. Lo que importa: que un aviso repetido no cree una segunda venta, que un pago
 * que llega sin stock no invente una, y que un segundo pago del mismo pedido no se pierda.
 */
const h = vi.hoisted(() => ({
  prisma: {
    storeOrder: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  recordSale: vi.fn(),
  recordDischarge: vi.fn(),
  lockStockRows: vi.fn(),
  reservedQtyByKey: vi.fn(),
  emails: {
    sendOrderPaidEmail: vi.fn(),
    sendNewOrderNotice: vi.fn(),
    sendPaidNoStockAlert: vi.fn(),
    sendDuplicatePaymentAlert: vi.fn(),
    sendOrderReadyEmail: vi.fn(),
  },
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/sales/record-sale", () => ({ recordSale: h.recordSale }));
vi.mock("@/lib/platform-fee/ledger", () => ({ recordDischarge: h.recordDischarge }));
vi.mock("./stock-lock", () => ({ lockStockRows: h.lockStockRows }));
vi.mock("./repository", () => ({ reservedQtyByKey: h.reservedQtyByKey }));
vi.mock("./emails", () => h.emails);

const { creditStorePayment, hasStockForOrder } = await import("./credit-payment");

type Status = "PENDING_PAYMENT" | "PAID" | "READY" | "DELIVERED" | "CANCELLED" | "EXPIRED" | "PAID_NO_STOCK";

function pedido(over: { status?: Status; mpPaymentId?: string | null } = {}) {
  return {
    id: "ord1",
    workspaceId: "ws1",
    orderNumber: 7,
    status: over.status ?? "PENDING_PAYMENT",
    mpPaymentId: over.mpPaymentId ?? null,
    buyerName: "Ana Pérez",
    buyerEmail: "ana@example.com",
    buyerPhone: "341555",
    totalArs: "25000.00",
    feeArs: "1500.00",
    feeBps: 500,
    items: [
      {
        productId: "p1",
        variantId: "v1",
        productName: "Remera",
        variantName: "M",
        qty: 2,
        unitPriceArs: "10000.00",
      },
      {
        productId: "p2",
        variantId: null,
        productName: "Taza",
        variantName: null,
        qty: 1,
        unitPriceArs: "5000.00",
      },
    ],
  };
}

function crearTx(
  order: ReturnType<typeof pedido>,
  stock: { p1?: number; v1?: number; p2?: number } = {},
  over: { eventoDuplicado?: boolean } = {},
) {
  return {
    $queryRaw: vi.fn(async () => []),
    storeOrder: {
      findFirst: vi.fn(async () => order),
      updateMany: vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 })),
    },
    storeOrderEvent: {
      create: vi.fn(async () => ({})),
      findFirst: vi.fn(async () => (over.eventoDuplicado ? { id: "ev" } : null)),
    },
    product: {
      findMany: vi.fn(async () => [
        { id: "p1", tracksStock: true, stockQty: stock.p1 ?? 10, costArs: "4000.00" },
        { id: "p2", tracksStock: true, stockQty: stock.p2 ?? 10, costArs: null },
      ]),
    },
    productVariant: {
      findMany: vi.fn(async () => [{ id: "v1", stockQty: stock.v1 ?? 5 }]),
    },
    sale: { findUnique: vi.fn(async () => ({ clientId: "cli1" })) },
  };
}

let tx: ReturnType<typeof crearTx>;

function preparar(order: ReturnType<typeof pedido>, stock?: Parameters<typeof crearTx>[1], over?: Parameters<typeof crearTx>[2]) {
  tx = crearTx(order, stock, over);
  h.prisma.storeOrder.findUnique.mockResolvedValue({ workspaceId: order.workspaceId });
  h.prisma.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.recordSale.mockResolvedValue({ saleId: "sale1", saleNumber: 99, deposited: true });
  h.reservedQtyByKey.mockResolvedValue(new Map());
});

const fechaPago = new Date("2026-10-04T15:00:00Z");

describe("creditStorePayment — pedido esperando el pago", () => {
  it("con stock: pasa a PAID y crea UNA venta con Mercado Pago, renglones con talle y el cliente nuevo", async () => {
    preparar(pedido());
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1", paidAt: fechaPago });

    expect(r).toEqual({ applied: true, status: "PAID" });
    expect(h.recordSale).toHaveBeenCalledTimes(1);
    const [, input] = h.recordSale.mock.calls[0];
    expect(input).toMatchObject({
      workspaceId: "ws1",
      createdByUserId: null,
      occurredAt: fechaPago,
      paymentMethod: "MERCADO_PAGO",
      discountMinor: 0,
      note: "Pedido online #7",
      client: { mode: "new", firstName: "Ana Pérez", lastName: null, phone: "341555", email: "ana@example.com" },
    });
    expect(input.lines).toEqual([
      {
        productId: "p1",
        variantId: "v1",
        description: "Remera — M",
        qty: 2,
        unitPriceMinor: 10_000_00,
        unitCostMinor: 4_000_00,
        priceWasOverridden: false,
      },
      {
        productId: "p2",
        variantId: null,
        description: "Taza",
        qty: 1,
        unitPriceMinor: 5_000_00,
        unitCostMinor: null,
        priceWasOverridden: false,
      },
    ]);

    // El pedido queda pagado, con su venta y su cliente, y con el pago guardado.
    const datos = tx.storeOrder.updateMany.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(datos).toContainEqual(expect.objectContaining({ mpPaymentId: "mp1", holdExpiresAt: null }));
    expect(datos).toContainEqual(
      expect.objectContaining({ status: "PAID", paidAt: fechaPago, saleId: "sale1", clientId: "cli1" }),
    );
    for (const c of tx.storeOrder.updateMany.mock.calls) {
      expect((c[0] as { where: Record<string, unknown> }).where).toMatchObject({ id: "ord1", workspaceId: "ws1" });
    }
    expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "ord1", fromStatus: "PENDING_PAYMENT", toStatus: "PAID" }),
    });
  });

  it("bloquea el pedido y el stock, y calcula lo retenido sin contar este pedido", async () => {
    preparar(pedido());
    await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(h.lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: ["p1", "p2"], variantIds: ["v1"] });
    expect(h.reservedQtyByKey).toHaveBeenCalledWith("ws1", tx, { excludeOrderId: "ord1" });
    // Primero el bloqueo, después la lectura de lo retenido.
    expect(h.lockStockRows.mock.invocationCallOrder[0]).toBeLessThan(h.reservedQtyByKey.mock.invocationCallOrder[0]);
  });

  it("asienta la deuda cobrada: lo retenido menos la comisión propia", async () => {
    preparar(pedido());
    await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    // 5% de $25.000 = $1.250 propios; se retuvieron $1.500: $250 eran deuda.
    expect(h.recordDischarge).toHaveBeenCalledWith(tx, expect.objectContaining({ workspaceId: "ws1", amountMinor: 250_00 }));
  });

  it("avisa al comprador y a la institución DESPUÉS de la transacción", async () => {
    preparar(pedido());
    await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(h.emails.sendOrderPaidEmail).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
    expect(h.emails.sendNewOrderNotice).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
    expect(h.emails.sendOrderPaidEmail.mock.invocationCallOrder[0]).toBeGreaterThan(
      h.prisma.$transaction.mock.invocationCallOrder[0],
    );
  });

  it("si otros pedidos retienen lo que queda, no alcanza: PAID_NO_STOCK sin venta", async () => {
    preparar(pedido(), { v1: 3 });
    h.reservedQtyByKey.mockResolvedValue(new Map([["p1:v1", 2]]));
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
  });
});

describe("creditStorePayment — avisos repetidos y pagos dobles", () => {
  it("el mismo pago sobre un pedido ya pagado: aviso repetido, sin segunda venta", async () => {
    preparar(pedido({ status: "PAID", mpPaymentId: "mp1" }));
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: false, status: "PAID", motivo: "aviso repetido" });
    expect(h.recordSale).not.toHaveBeenCalled();
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(h.emails.sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  it.each(["PAID", "READY", "DELIVERED", "PAID_NO_STOCK"] as const)(
    "OTRO pago sobre un pedido %s: no cambia nada, deja constancia y alerta a la institución",
    async (status) => {
      preparar(pedido({ status, mpPaymentId: "mp1" }));
      const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp2" });
      expect(r).toEqual({ applied: false, status, motivo: "pago duplicado" });
      expect(h.recordSale).not.toHaveBeenCalled();
      expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
      expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
        data: { orderId: "ord1", fromStatus: status, toStatus: status, note: "Pago duplicado mp2: hay que devolverlo" },
      });
      expect(h.emails.sendDuplicatePaymentAlert).toHaveBeenCalledWith({
        workspaceId: "ws1",
        orderId: "ord1",
        providerPaymentId: "mp2",
      });
    },
  );

  it("el aviso repetido de un pago doble no vuelve a alertar", async () => {
    preparar(pedido({ status: "PAID", mpPaymentId: "mp1" }), {}, { eventoDuplicado: true });
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp2" });
    expect(r).toEqual({ applied: false, status: "PAID", motivo: "aviso repetido" });
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.emails.sendDuplicatePaymentAlert).not.toHaveBeenCalled();
  });

  it("un pedido que no existe no acredita nada", async () => {
    h.prisma.storeOrder.findUnique.mockResolvedValue(null);
    const r = await creditStorePayment({ orderId: "nada", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: false, status: null, motivo: "el pedido no existe" });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("creditStorePayment — pagos tardíos", () => {
  it("vencido con stock: igual pasa a PAID con su venta", async () => {
    preparar(pedido({ status: "EXPIRED" }));
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID" });
    expect(h.recordSale).toHaveBeenCalledTimes(1);
  });

  it("vencido sin stock: PAID_NO_STOCK, sin venta, y alerta a la institución", async () => {
    preparar(pedido({ status: "EXPIRED" }), { v1: 1 });
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
    expect(h.recordDischarge).not.toHaveBeenCalled();
    expect(tx.storeOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", workspaceId: "ws1" },
      data: expect.objectContaining({ status: "PAID_NO_STOCK", mpPaymentId: "mp1", holdExpiresAt: null }),
    });
    expect(h.emails.sendPaidNoStockAlert).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
    expect(h.emails.sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  it("cancelado, aunque haya stock: PAID_NO_STOCK (la plata está, el pedido no)", async () => {
    preparar(pedido({ status: "CANCELLED" }));
    const r = await creditStorePayment({ orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
  });
});

describe("hasStockForOrder", () => {
  const items = [
    { productId: "p1", variantId: "v1", qty: 2 },
    { productId: "p2", variantId: null, qty: 1 },
  ];
  const productos = new Map([
    ["p1", { tracksStock: true, stockQty: 10 }],
    ["p2", { tracksStock: true, stockQty: 1 }],
  ]);
  const talles = new Map([["v1", 2]]);

  it("alcanza justo", () => {
    expect(hasStockForOrder(items, productos, talles, new Map())).toBe(true);
  });
  it("lo retenido por otros resta", () => {
    expect(hasStockForOrder(items, productos, talles, new Map([["p2:-", 1]]))).toBe(false);
  });
  it("un producto que no controla stock siempre alcanza", () => {
    const sinControl = new Map([...productos, ["p2", { tracksStock: false, stockQty: 0 }]]);
    expect(hasStockForOrder(items, sinControl, talles, new Map([["p2:-", 5]]))).toBe(true);
  });
  it("un producto o talle borrado no alcanza: alguien tiene que mirarlo", () => {
    expect(hasStockForOrder([{ productId: null, variantId: null, qty: 1 }], productos, talles, new Map())).toBe(false);
    expect(hasStockForOrder([{ productId: "p1", variantId: "v9", qty: 1 }], productos, talles, new Map())).toBe(false);
  });
});
