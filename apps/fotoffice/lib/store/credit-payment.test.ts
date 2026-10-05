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
vi.mock("@/lib/sales/stock-lock", () => ({ lockStockRows: h.lockStockRows }));
vi.mock("./repository", () => ({ reservedQtyByKey: h.reservedQtyByKey }));
vi.mock("./emails", () => h.emails);

const { creditStorePayment, finalizePaidOrder, hasStockForOrder, lockAndCheckOrderStock } = await import("./credit-payment");
const { STORE_NOTE_ROYALTY_UNASSIGNED } = await import("./constants");

/** Las columnas de obra de un renglón de producto: todas vacías. */
const SIN_OBRA = {
  artworkListingId: null as string | null,
  printFormatId: null as string | null,
  printFormatName: null as string | null,
  royaltyBps: null as number | null,
  artworkAuthorUserId: null as number | null,
};

/** Un renglón del pedido de prueba: de producto o de obra. */
type Renglon = typeof SIN_OBRA & {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  qty: number;
  unitPriceArs: string;
  lineTotalArs: string;
};

type Status = "PENDING_PAYMENT" | "PAID" | "READY" | "DELIVERED" | "CANCELLED" | "EXPIRED" | "PAID_NO_STOCK";

function pedido(over: { status?: Status; mpPaymentId?: string | null } = {}) {
  return {
    subtotalArs: "25000.00",
    shippingArs: "0.00",
    shippingMethod: null as string | null,
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
    items: <Renglon[]>[
      {
        ...SIN_OBRA,
        id: "it1",
        productId: "p1",
        variantId: "v1",
        productName: "Remera",
        variantName: "M",
        qty: 2,
        unitPriceArs: "10000.00",
        lineTotalArs: "20000.00",
      },
      {
        ...SIN_OBRA,
        id: "it2",
        productId: "p2",
        variantId: null,
        productName: "Taza",
        variantName: null,
        qty: 1,
        unitPriceArs: "5000.00",
        lineTotalArs: "5000.00",
      },
    ],
  };
}

function crearTx(
  order: ReturnType<typeof pedido>,
  stock: { p1?: number; v1?: number; p2?: number } = {},
  over: { eventoDuplicado?: boolean; p2Talles?: boolean } = {},
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
        { id: "p1", tracksStock: true, stockQty: stock.p1 ?? 10, costArs: "4000.00", variants: [{ id: "v1" }] },
        {
          id: "p2",
          tracksStock: true,
          stockQty: stock.p2 ?? 10,
          costArs: null,
          // La taza no tenía talles cuando se hizo el pedido; `p2Talles` simula que se le cargaron después.
          variants: over.p2Talles ? [{ id: "v7" }] : [],
        },
      ]),
    },
    productVariant: {
      findMany: vi.fn(async () => [{ id: "v1", stockQty: stock.v1 ?? 5 }]),
    },
    sale: { findUnique: vi.fn(async () => ({ clientId: "cli1" })) },
    printFormat: {
      findMany: vi.fn(async () => [
        { id: "f1", costArs: "3000.00" },
        { id: "f2", costArs: null },
      ]),
    },
    artworkListing: {
      findMany: vi.fn(async () => [
        { id: "l1", contestId: "c1" },
        { id: "l2", contestId: "c2" },
      ]),
    },
    artworkRoyalty: {
      createMany: vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 })),
    },
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
/** Lo que Mercado Pago dice que se cobró: el total exacto del pedido, en pesos. */
const cobro = { amountMinor: 25_000_00, currency: "ARS" };

describe("creditStorePayment — pedido esperando el pago", () => {
  it("con stock: pasa a PAID y crea UNA venta con Mercado Pago, renglones con talle y el cliente nuevo", async () => {
    preparar(pedido());
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1", paidAt: fechaPago });

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
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(h.lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: ["p1", "p2"], variantIds: ["v1"] });
    expect(h.reservedQtyByKey).toHaveBeenCalledWith("ws1", tx, { excludeOrderId: "ord1" });
    // Primero el bloqueo, después la lectura de lo retenido.
    expect(h.lockStockRows.mock.invocationCallOrder[0]).toBeLessThan(h.reservedQtyByKey.mock.invocationCallOrder[0]);
  });

  it("asienta la deuda cobrada: lo retenido menos la comisión propia", async () => {
    preparar(pedido());
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    // 5% de $25.000 = $1.250 propios; se retuvieron $1.500: $250 eran deuda.
    expect(h.recordDischarge).toHaveBeenCalledWith(tx, expect.objectContaining({ workspaceId: "ws1", amountMinor: 250_00 }));
  });

  it("avisa al comprador y a la institución DESPUÉS de la transacción", async () => {
    preparar(pedido());
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(h.emails.sendOrderPaidEmail).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
    expect(h.emails.sendNewOrderNotice).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
    expect(h.emails.sendOrderPaidEmail.mock.invocationCallOrder[0]).toBeGreaterThan(
      h.prisma.$transaction.mock.invocationCallOrder[0],
    );
  });

  it("si otros pedidos retienen lo que queda, no alcanza: PAID_NO_STOCK sin venta", async () => {
    preparar(pedido(), { v1: 3 });
    h.reservedQtyByKey.mockResolvedValue(new Map([["p1:v1", 2]]));
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
  });

  it("un renglón sin talle de un producto que DESPUÉS tuvo talles no alcanza: PAID_NO_STOCK sin venta", async () => {
    preparar(pedido(), {}, { p2Talles: true });
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
    // Se pregunta si el producto tiene talles hoy, filtrando por workspace.
    expect(tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["p1", "p2"] }, workspaceId: "ws1" },
        select: expect.objectContaining({ variants: { where: { workspaceId: "ws1" }, select: { id: true }, take: 1 } }),
      }),
    );
  });
});

describe("lockAndCheckOrderStock (también lo usa reponer: PAID_NO_STOCK → PAID)", () => {
  it("con el producto todavía sin talles, el renglón sin talle alcanza", async () => {
    const t = crearTx(pedido());
    expect(await lockAndCheckOrderStock(t as never, pedido() as never)).toBe(true);
  });

  it("si al producto le cargaron talles después del pedido, el renglón sin talle no alcanza", async () => {
    const t = crearTx(pedido(), {}, { p2Talles: true });
    expect(await lockAndCheckOrderStock(t as never, pedido() as never)).toBe(false);
  });
});

describe("creditStorePayment — avisos repetidos y pagos dobles", () => {
  it("el mismo pago sobre un pedido ya pagado: aviso repetido, sin segunda venta", async () => {
    preparar(pedido({ status: "PAID", mpPaymentId: "mp1" }));
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: false, status: "PAID", motivo: "aviso repetido" });
    expect(h.recordSale).not.toHaveBeenCalled();
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(h.emails.sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  it.each(["PAID", "READY", "DELIVERED", "PAID_NO_STOCK"] as const)(
    "OTRO pago sobre un pedido %s: no cambia nada, deja constancia y alerta a la institución",
    async (status) => {
      preparar(pedido({ status, mpPaymentId: "mp1" }));
      const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp2" });
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
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp2" });
    expect(r).toEqual({ applied: false, status: "PAID", motivo: "aviso repetido" });
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.emails.sendDuplicatePaymentAlert).not.toHaveBeenCalled();
  });

  it("un pedido que no existe no acredita nada", async () => {
    h.prisma.storeOrder.findUnique.mockResolvedValue(null);
    const r = await creditStorePayment({ ...cobro, orderId: "nada", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: false, status: null, motivo: "el pedido no existe" });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("creditStorePayment — la idempotencia la decide el pago, no el estado", () => {
  it("cancelado DESPUÉS de pagarse, mismo pago: aviso repetido (no resucita el pedido)", async () => {
    preparar(pedido({ status: "CANCELLED", mpPaymentId: "mp1" }));
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: false, status: "CANCELLED", motivo: "aviso repetido" });
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.storeOrderEvent.create).not.toHaveBeenCalled();
    expect(h.emails.sendPaidNoStockAlert).not.toHaveBeenCalled();
  });

  it("cancelado después de pagarse, OTRO pago: pago duplicado, sin pisar el primer id", async () => {
    preparar(pedido({ status: "CANCELLED", mpPaymentId: "mp1" }));
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp2" });
    expect(r).toEqual({ applied: false, status: "CANCELLED", motivo: "pago duplicado" });
    expect(tx.storeOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: { orderId: "ord1", fromStatus: "CANCELLED", toStatus: "CANCELLED", note: "Pago duplicado mp2: hay que devolverlo" },
    });
    expect(h.emails.sendDuplicatePaymentAlert).toHaveBeenCalled();
  });
});

describe("creditStorePayment — pedido con envío (E12)", () => {
  /** $25.000 de productos + $4.500 de envío a domicilio = $29.500. */
  const conEnvio = (shippingMethod: "HOME" | "BRANCH" = "HOME") => ({
    ...pedido(),
    shippingArs: "4500.00",
    totalArs: "29500.00",
    shippingMethod,
    // 5% de $25.000 = $1.250 propios + $250 de deuda: la comisión no toca el envío.
    feeArs: "1500.00",
  });
  const cobroTotal = { amountMinor: 29_500_00, currency: "ARS" };

  it("agrega el renglón suelto del envío y la venta suma el total del pedido", async () => {
    preparar(conEnvio());
    const r = await creditStorePayment({ ...cobroTotal, orderId: "ord1", providerPaymentId: "mp1", paidAt: fechaPago });

    expect(r).toEqual({ applied: true, status: "PAID" });
    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: { qty: number; unitPriceMinor: number }[] }];
    expect(input.lines).toHaveLength(3);
    expect(input.lines[2]).toEqual({
      productId: null,
      variantId: null,
      description: "Envío a domicilio",
      qty: 1,
      unitPriceMinor: 4_500_00,
      unitCostMinor: null,
      priceWasOverridden: false,
    });
    const totalVenta = input.lines.reduce((s, l) => s + l.qty * l.unitPriceMinor, 0);
    expect(totalVenta).toBe(29_500_00);
  });

  it("a sucursal, el renglón lo dice", async () => {
    preparar(conEnvio("BRANCH"));
    await creditStorePayment({ ...cobroTotal, orderId: "ord1", providerPaymentId: "mp1" });
    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: { description: string }[] }];
    expect(input.lines.at(-1)?.description).toBe("Envío a sucursal");
  });

  it("la deuda cobrada se calcula contra la comisión de los productos, no del total", async () => {
    preparar(conEnvio());
    await creditStorePayment({ ...cobroTotal, orderId: "ord1", providerPaymentId: "mp1" });
    expect(h.recordDischarge).toHaveBeenCalledWith(tx, expect.objectContaining({ amountMinor: 250_00 }));
  });

  it("el control de monto usa el total con envío: pagar sólo los productos no alcanza", async () => {
    preparar(conEnvio());
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
  });

  it("sin envío no se agrega ningún renglón suelto", async () => {
    preparar(pedido());
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: { productId: string | null }[] }];
    expect(input.lines.every((l) => l.productId !== null)).toBe(true);
  });
});

describe("creditStorePayment — monto y moneda", () => {
  it.each([
    ["menos que el total", { amountMinor: 24_999_99, currency: "ARS" }],
    ["otra moneda", { amountMinor: 25_000_00, currency: "USD" }],
  ])("%s: PAID_NO_STOCK sin venta, con constancia y alerta", async (_caso, pagoMp) => {
    preparar(pedido());
    const r = await creditStorePayment({ ...pagoMp, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
    expect(h.lockStockRows).not.toHaveBeenCalled();
    expect(tx.storeOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", workspaceId: "ws1" },
      data: expect.objectContaining({ status: "PAID_NO_STOCK", mpPaymentId: "mp1" }),
    });
    expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toStatus: "PAID_NO_STOCK", note: "Pago con monto distinto: revisar" }),
    });
    expect(h.emails.sendPaidNoStockAlert).toHaveBeenCalledWith({ workspaceId: "ws1", orderId: "ord1" });
  });

  it("de más, en pesos: se acredita (cubre el pedido; Checkout Pro cobra el total de la preferencia)", async () => {
    preparar(pedido());
    const r = await creditStorePayment({ amountMinor: 26_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID");
  });

  it("sin fecha de aprobación, la venta lleva la fecha de ahora", async () => {
    preparar(pedido());
    const antes = Date.now();
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1", paidAt: null });
    const occurredAt = (h.recordSale.mock.calls[0][1] as { occurredAt: Date }).occurredAt;
    expect(occurredAt.getTime()).toBeGreaterThanOrEqual(antes);
  });
});

describe("creditStorePayment — pagos tardíos", () => {
  it("vencido con stock: igual pasa a PAID con su venta", async () => {
    preparar(pedido({ status: "EXPIRED" }));
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID" });
    expect(h.recordSale).toHaveBeenCalledTimes(1);
  });

  it("vencido sin stock: PAID_NO_STOCK, sin venta, y alerta a la institución", async () => {
    preparar(pedido({ status: "EXPIRED" }), { v1: 1 });
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
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
    const r = await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r).toEqual({ applied: true, status: "PAID_NO_STOCK" });
    expect(h.recordSale).not.toHaveBeenCalled();
  });
});

describe("hasStockForOrder", () => {
  const items = [
    { productId: "p1", variantId: "v1", qty: 2 },
    { productId: "p2", variantId: null, qty: 1 },
  ];
  const productos = new Map<string, { tracksStock: boolean; stockQty: number; hasVariants?: boolean }>([
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
  it("un renglón sin talle de un producto que ahora tiene talles no alcanza (D4)", () => {
    const conTalles = new Map([...productos, ["p2", { tracksStock: true, stockQty: 50, hasVariants: true }]]);
    expect(hasStockForOrder(items, conTalles, talles, new Map())).toBe(false);
    // Con talle sigue funcionando igual: p1 tiene talles y su renglón trae el talle.
    const p1ConTalles = new Map([...productos, ["p1", { tracksStock: true, stockQty: 10, hasVariants: true }]]);
    expect(hasStockForOrder(items, p1ConTalles, talles, new Map())).toBe(true);
  });
  it("un producto o talle borrado no alcanza: alguien tiene que mirarlo", () => {
    expect(hasStockForOrder([{ productId: null, variantId: null, qty: 1 }], productos, talles, new Map())).toBe(false);
    expect(hasStockForOrder([{ productId: "p1", variantId: "v9", qty: 1 }], productos, talles, new Map())).toBe(false);
  });
});

// ── Obras de concursos (etapa 3: O10, O11) ──────────────────────────────────


/** Un renglón de obra como lo deja `artworkOrderItemData`: sin producto, con formato, regalía y autor. */
function obra(over: Partial<Renglon> = {}): Renglon {
  return {
    id: "it3",
    productId: null,
    variantId: null,
    productName: "Atardecer",
    variantName: "Impresión 30 × 45 cm",
    qty: 2,
    unitPriceArs: "15000.00",
    lineTotalArs: "30000.00",
    artworkListingId: "l1",
    printFormatId: "f1",
    printFormatName: "Impresión 30 × 45 cm",
    royaltyBps: 2000,
    artworkAuthorUserId: 501,
    ...over,
  };
}

const niebla = () =>
  obra({
    id: "it4",
    productName: "Niebla",
    variantName: "Cuadro 50 × 70 cm",
    printFormatName: "Cuadro 50 × 70 cm",
    qty: 1,
    unitPriceArs: "33333.33",
    lineTotalArs: "33333.33",
    artworkListingId: "l2",
    printFormatId: "f2",
    royaltyBps: 1500,
    artworkAuthorUserId: 502,
  });

/** Sólo una obra: $30.000. */
function pedidoDeObra(over: { shippingArs?: string; totalArs?: string; items?: Renglon[] } = {}) {
  return {
    ...pedido(),
    subtotalArs: "30000.00",
    totalArs: over.totalArs ?? "30000.00",
    shippingArs: over.shippingArs ?? "0.00",
    shippingMethod: over.shippingArs ? "HOME" : null,
    feeArs: "1500.00",
    items: over.items ?? [obra()],
  };
}

function regalias(): Record<string, unknown>[] {
  return tx.artworkRoyalty.createMany.mock.calls.flatMap((c) => (c[0] as { data: Record<string, unknown>[] }).data);
}

describe("creditStorePayment — pedido sólo de obras", () => {
  it("pasa a PAID (las obras no tienen stock) con renglón suelto de obra y su regalía", async () => {
    preparar(pedidoDeObra());
    const r = await creditStorePayment({ amountMinor: 30_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });

    expect(r).toEqual({ applied: true, status: "PAID" });
    // Nada de stock que bloquear: sólo productos y talles se bloquean.
    expect(h.lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: [], variantIds: [] });
    expect(tx.product.findMany).not.toHaveBeenCalled();

    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: unknown[] }];
    expect(input.lines).toEqual([
      {
        productId: null,
        variantId: null,
        description: "Obra «Atardecer» — Impresión 30 × 45 cm",
        qty: 2,
        unitPriceMinor: 15_000_00,
        unitCostMinor: 3_000_00,
        priceWasOverridden: false,
      },
    ]);
    // El costo es el del formato HOY, del workspace.
    expect(tx.printFormat.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1"] }, workspaceId: "ws1" },
      select: { id: true, costArs: true },
    });

    expect(tx.artworkListing.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["l1"] }, workspaceId: "ws1" },
      select: { id: true, contestId: true },
    });
    expect(tx.artworkRoyalty.createMany).toHaveBeenCalledTimes(1);
    expect(tx.artworkRoyalty.createMany.mock.calls[0]![0]).toMatchObject({ skipDuplicates: true });
    expect(regalias()).toEqual([
      {
        workspaceId: "ws1",
        orderId: "ord1",
        orderItemId: "it3",
        authorUserId: 501,
        contestId: "c1",
        baseArs: "30000.00",
        royaltyBps: 2000,
        amountArs: "6000.00",
        status: "ACCRUED",
      },
    ]);
    expect(h.emails.sendOrderPaidEmail).toHaveBeenCalled();
  });

  it("el envío no entra en la base de la regalía", async () => {
    preparar(pedidoDeObra({ shippingArs: "4500.00", totalArs: "34500.00" }));
    const r = await creditStorePayment({ amountMinor: 34_500_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID");
    expect(regalias()).toEqual([expect.objectContaining({ baseArs: "30000.00", amountArs: "6000.00" })]);
    // El envío sigue yendo a la venta como renglón suelto.
    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: { description: string }[] }];
    expect(input.lines.map((l) => l.description)).toEqual(["Obra «Atardecer» — Impresión 30 × 45 cm", "Envío a domicilio"]);
  });

  it("un renglón sin regalía congelada usa el 20 % por omisión", async () => {
    preparar(pedidoDeObra({ items: [obra({ royaltyBps: null })] }));
    await creditStorePayment({ amountMinor: 30_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(regalias()).toEqual([expect.objectContaining({ royaltyBps: 2000, amountArs: "6000.00" })]);
  });

  it("no vuelve a mirar el permiso del autor: un pedido hecho mientras la obra se vendía se honra", async () => {
    preparar(pedidoDeObra());
    await creditStorePayment({ amountMinor: 30_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    // El único bloqueo propio es el del pedido (el de stock es `lockStockRows`): ni permisos ni fichas.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx).not.toHaveProperty("artworkConsent");
    expect(regalias()).toHaveLength(1);
  });

  it("sin autor: se acredita igual, sin esa regalía y con una constancia para revisar", async () => {
    preparar(pedidoDeObra({ items: [obra({ artworkAuthorUserId: null })] }));
    const r = await creditStorePayment({ amountMinor: 30_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID");
    expect(tx.artworkRoyalty.createMany).not.toHaveBeenCalled();
    expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "ord1", note: expect.stringContaining(STORE_NOTE_ROYALTY_UNASSIGNED) }),
    });
  });

  it("aviso repetido del mismo pago: ni venta ni regalías nuevas", async () => {
    preparar({ ...pedidoDeObra(), status: "PAID", mpPaymentId: "mp1" });
    const r = await creditStorePayment({ amountMinor: 30_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.motivo).toBe("aviso repetido");
    expect(tx.artworkRoyalty.createMany).not.toHaveBeenCalled();
  });

  it("finalizar dos veces escribe las mismas regalías con skipDuplicates (una por renglón)", async () => {
    preparar(pedidoDeObra());
    const order = pedidoDeObra() as never;
    await finalizePaidOrder(tx as never, order, fechaPago);
    await finalizePaidOrder(tx as never, order, fechaPago);
    const [primera, segunda] = tx.artworkRoyalty.createMany.mock.calls.map((c) => c[0]);
    expect(primera).toEqual(segunda);
    expect(primera).toMatchObject({ skipDuplicates: true });
  });

  it("pago menor al total: PAID_NO_STOCK, sin venta y sin regalías", async () => {
    preparar(pedidoDeObra());
    const r = await creditStorePayment({ amountMinor: 29_000_00, currency: "ARS", orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID_NO_STOCK");
    expect(tx.artworkRoyalty.createMany).not.toHaveBeenCalled();
  });
});

describe("creditStorePayment — pedido mixto (productos y obras)", () => {
  const mixto = () => ({
    ...pedido(),
    subtotalArs: "88333.33",
    totalArs: "88333.33",
    items: [...pedido().items, obra(), niebla()],
  });
  const cobroMixto = { amountMinor: 88_333_33, currency: "ARS" };

  it("productos como siempre, obras como renglón suelto, una regalía por obra", async () => {
    preparar(mixto());
    const r = await creditStorePayment({ ...cobroMixto, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID");

    expect(h.lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: ["p1", "p2"], variantIds: ["v1"] });
    const [, input] = h.recordSale.mock.calls[0] as [unknown, { lines: Record<string, unknown>[] }];
    expect(input.lines).toHaveLength(4);
    expect(input.lines[0]).toMatchObject({ productId: "p1", variantId: "v1", description: "Remera — M", unitCostMinor: 4_000_00 });
    expect(input.lines[1]).toMatchObject({ productId: "p2", description: "Taza", unitCostMinor: null });
    expect(input.lines[2]).toMatchObject({ productId: null, description: "Obra «Atardecer» — Impresión 30 × 45 cm", unitCostMinor: 3_000_00 });
    expect(input.lines[3]).toMatchObject({
      productId: null,
      variantId: null,
      description: "Obra «Niebla» — Cuadro 50 × 70 cm",
      qty: 1,
      unitPriceMinor: 33_333_33,
      unitCostMinor: null,
    });

    expect(regalias()).toEqual([
      expect.objectContaining({ orderItemId: "it3", authorUserId: 501, contestId: "c1", baseArs: "30000.00", amountArs: "6000.00" }),
      // 15 % de $33.333,33 = $4.999,9995 → $5.000,00 (redondeo al centavo).
      expect.objectContaining({ orderItemId: "it4", authorUserId: 502, contestId: "c2", baseArs: "33333.33", royaltyBps: 1500, amountArs: "5000.00" }),
    ]);
  });

  it("si los productos no alcanzan, PAID_NO_STOCK sin venta ni regalías (las obras no salvan el pedido)", async () => {
    preparar(mixto(), { v1: 1 });
    const r = await creditStorePayment({ ...cobroMixto, orderId: "ord1", providerPaymentId: "mp1" });
    expect(r.status).toBe("PAID_NO_STOCK");
    expect(h.recordSale).not.toHaveBeenCalled();
    expect(tx.artworkRoyalty.createMany).not.toHaveBeenCalled();
  });

  it("pedido sólo de productos: ni formatos, ni fichas, ni regalías", async () => {
    preparar(pedido());
    await creditStorePayment({ ...cobro, orderId: "ord1", providerPaymentId: "mp1" });
    expect(tx.printFormat.findMany).not.toHaveBeenCalled();
    expect(tx.artworkListing.findMany).not.toHaveBeenCalled();
    expect(tx.artworkRoyalty.createMany).not.toHaveBeenCalled();
  });
});

describe("stock con obras (también lo usa reponer: PAID_NO_STOCK → PAID)", () => {
  it("hasStockForOrder ignora los renglones de obra", () => {
    const productos = new Map([["p1", { tracksStock: true, stockQty: 1 }]]);
    const deObra = { productId: null, variantId: null, qty: 5, artworkListingId: "l1", printFormatName: "Impresión" };
    expect(hasStockForOrder([deObra], new Map(), new Map(), new Map())).toBe(true);
    expect(hasStockForOrder([deObra, { productId: "p1", variantId: null, qty: 1 }], productos, new Map(), new Map())).toBe(true);
    expect(hasStockForOrder([deObra, { productId: "p1", variantId: null, qty: 2 }], productos, new Map(), new Map())).toBe(false);
  });

  it("una obra cuya ficha se borró (sin ficha) igual se reconoce por el formato congelado", () => {
    const sinFicha = { productId: null, variantId: null, qty: 1, artworkListingId: null, printFormatName: "Impresión" };
    expect(hasStockForOrder([sinFicha], new Map(), new Map(), new Map())).toBe(true);
  });

  it("lockAndCheckOrderStock: un pedido sólo de obras siempre alcanza", async () => {
    const t = crearTx(pedidoDeObra());
    expect(await lockAndCheckOrderStock(t as never, pedidoDeObra() as never)).toBe(true);
  });
});
