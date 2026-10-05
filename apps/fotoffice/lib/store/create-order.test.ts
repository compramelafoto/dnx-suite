import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutInput } from "./checkout-input";
import type { StorefrontProductRow } from "./storefront";
import { hashAccessToken, orderAccessToken } from "./access-token";

/**
 * `createStoreOrder` con un `tx` falso, mismo molde que `lib/sales/record-sale.test.ts`: lo que
 * importa es QUÉ se escribe y en qué ORDEN (el bloqueo antes de leer lo retenido). La carrera de
 * verdad —dos compradores por la última unidad— la prueba `create-order.db.test.ts` contra Postgres.
 *
 * `checkCartLines` (puro) NO se mockea: es la regla de disponibilidad que importa de verdad.
 */
const { prismaMock, lockStockRows, loadCartCatalog, reservedQtyByKey, orden } = vi.hoisted(() => {
  const orden: string[] = [];
  return {
    orden,
    prismaMock: {
      storeOrder: { findUnique: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(),
    },
    lockStockRows: vi.fn(async () => {
      orden.push("bloqueo");
    }),
    loadCartCatalog: vi.fn(),
    reservedQtyByKey: vi.fn(),
  };
});

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return { Prisma: real.Prisma, prisma: prismaMock };
});
vi.mock("@/lib/sales/stock-lock", () => ({ lockStockRows }));
vi.mock("./repository", () => ({ loadCartCatalog, reservedQtyByKey }));

const { createStoreOrder } = await import("./create-order");

const KEY = "clave-de-prueba";
const NOW = new Date("2026-10-04T15:00:00.000Z");

const dec = (s: string) => ({ toString: () => s });

function producto(over: Partial<StorefrontProductRow> = {}): StorefrontProductRow {
  return {
    id: "p1",
    name: "Remera",
    description: null,
    priceArs: dec("10000.00"),
    tracksStock: true,
    stockQty: 1,
    imageUrl: "https://img/remera.jpg",
    category: null,
    variantCount: 0,
    listing: {
      slug: "remera",
      onlineTitle: null,
      onlineDescription: null,
      sizeChartImageUrl: null,
      maxPerOrder: null,
    },
    images: [],
    variants: [],
    ...over,
  };
}

const checkoutBase: CheckoutInput = {
  buyerName: "Ana Pérez",
  buyerEmail: "ana@example.com",
  buyerPhone: null,
  acceptsTerms: true,
  clientIdempotencyKey: "clave-idempotencia-0001",
  lines: [{ productId: "p1", variantId: null, qty: 1 }],
  delivery: { method: "PICKUP" },
};

function orderTx(over: Record<string, unknown> = {}) {
  return {
    storeOrder: {
      findFirst: vi.fn(async () => null),
      createMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { publicId: string } }) => ({
        id: "ord1",
        publicId: where.publicId,
        orderNumber: 1,
      })),
      findUnique: vi.fn(async () => null),
    },
    storeOrderItem: { createMany: vi.fn(async () => ({ count: 1 })) },
    storeOrderEvent: { create: vi.fn(async () => ({})) },
    ...over,
  };
}

let tx: ReturnType<typeof orderTx>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("STORE_ORDER_TOKEN_SECRET", KEY);
  orden.length = 0;
  prismaMock.storeOrder.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.storeOrder.count.mockReset().mockResolvedValue(0);
  tx = orderTx();
  prismaMock.$transaction.mockReset().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  lockStockRows.mockClear();
  loadCartCatalog.mockReset().mockImplementation(async () => {
    orden.push("catalogo");
    return new Map([["p1", producto()]]);
  });
  reservedQtyByKey.mockReset().mockImplementation(async () => {
    orden.push("reservado");
    return new Map();
  });
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

function primerPedido() {
  return (tx.storeOrder.createMany.mock.calls[0] as unknown as [{ data: Record<string, unknown>[] }])[0].data[0];
}

describe("createStoreOrder — sin clave para firmar el acceso", () => {
  it("falla cerrado, sin tocar la base, y avisa la falta de configuración sin datos del comprador", async () => {
    vi.stubEnv("STORE_ORDER_TOKEN_SECRET", "");
    vi.stubEnv("FOTOFFICE_CRON_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");

    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });

    expect(r).toEqual({ ok: false, error: "La tienda no está lista para cobrar. Escribile a la institución." });
    expect(prismaMock.storeOrder.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("ana@example.com");
  });
});

describe("createStoreOrder — disponibilidad", () => {
  it("disponible 1 y se piden 2 → error con problems, sin crear el pedido", async () => {
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [{ productId: "p1", variantId: null, qty: 2 }] },
      now: NOW,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/cambió/);
    expect(r.problems).toEqual([{ key: "p1:-", message: "Quedan 1 de Remera: ajustamos la cantidad." }]);
    expect(tx.storeOrder.createMany).not.toHaveBeenCalled();
  });

  it("lo retenido por otros pedidos cuenta: stock 1 con 1 retenida → agotado", async () => {
    reservedQtyByKey.mockResolvedValue(new Map([["p1:-", 1]]));
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems?.[0]?.message).toBe("Remera se agotó.");
  });

  it("bloquea las filas de stock ANTES de leer lo retenido, dentro de la transacción READ COMMITTED", async () => {
    await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [{ productId: "p1", variantId: "v1", qty: 1 }] },
      now: NOW,
    });

    expect(orden[0]).toBe("bloqueo");
    expect(orden.indexOf("bloqueo")).toBeLessThan(orden.indexOf("reservado"));
    expect(lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: ["p1"], variantIds: ["v1"] });
    expect(reservedQtyByKey).toHaveBeenCalledWith("ws1", tx, { now: NOW });
    expect(loadCartCatalog).toHaveBeenCalledWith("ws1", ["p1"], tx);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
  });

  it("las líneas repetidas se unen sumando antes de verificar: 1 + 1 con stock 1 → no alcanza", async () => {
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: {
        ...checkoutBase,
        lines: [
          { productId: "p1", variantId: null, qty: 1 },
          { productId: "p1", variantId: null, qty: 1 },
        ],
      },
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(tx.storeOrder.createMany).not.toHaveBeenCalled();
  });

  it("las líneas repetidas que alcanzan quedan como un solo renglón con la cantidad sumada", async () => {
    loadCartCatalog.mockResolvedValue(new Map([["p1", producto({ stockQty: 5 })]]));
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: {
        ...checkoutBase,
        lines: [
          { productId: "p1", variantId: null, qty: 2 },
          { productId: "p1", variantId: null, qty: 1 },
        ],
      },
      now: NOW,
    });
    expect(r.ok).toBe(true);
    const items = (tx.storeOrderItem.createMany.mock.calls[0] as unknown as [{ data: unknown[] }])[0].data;
    expect(items).toEqual([expect.objectContaining({ productId: "p1", qty: 3, lineTotalArs: "30000.00" })]);
  });
});

describe("createStoreOrder — el pedido creado", () => {
  it("usa el precio del talle, congela nombres e imagen del servidor, y retiene 15 minutos", async () => {
    loadCartCatalog.mockResolvedValue(
      new Map([
        [
          "p1",
          producto({
            variantCount: 2,
            listing: { ...producto().listing, onlineTitle: "Remera oficial" },
            variants: [
              { id: "v1", name: "S", priceArs: null, stockQty: 3 },
              { id: "v2", name: "XL", priceArs: dec("12500.00"), stockQty: 3 },
            ],
          }),
        ],
      ]),
    );

    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: "m1",
      checkout: { ...checkoutBase, lines: [{ productId: "p1", variantId: "v2", qty: 2 }] },
      now: NOW,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pedido = primerPedido();
    expect(pedido).toMatchObject({
      workspaceId: "ws1",
      orderNumber: 1,
      status: "PENDING_PAYMENT",
      buyerName: "Ana Pérez",
      buyerEmail: "ana@example.com",
      memberId: "m1",
      subtotalArs: "25000.00",
      totalArs: "25000.00",
      holdExpiresAt: new Date("2026-10-04T15:15:00.000Z"),
      legalAcceptedAt: NOW,
      legalVersion: "2026-10-04",
      clientIdempotencyKey: "clave-idempotencia-0001",
      publicId: r.publicId,
      accessTokenHash: hashAccessToken(r.accessToken),
    });
    expect(r.accessToken).toBe(orderAccessToken(r.publicId, KEY));
    expect(r.publicId).toMatch(/^ped_/);

    expect(tx.storeOrderItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: "ord1",
          productId: "p1",
          variantId: "v2",
          productName: "Remera oficial",
          variantName: "XL",
          productSlug: "remera",
          imageUrl: "https://img/remera.jpg",
          qty: 2,
          unitPriceArs: "12500.00",
          lineTotalArs: "25000.00",
        },
      ],
    });
    expect(tx.storeOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "ord1", fromStatus: null, toStatus: "PENDING_PAYMENT" }),
    });
  });

  it("si otro pedido tomó el número (count 0), relee el último y reintenta con el siguiente", async () => {
    let intentos = 0;
    tx.storeOrder.findFirst = vi.fn(async () => (intentos === 0 ? { orderNumber: 4 } : { orderNumber: 5 })) as never;
    tx.storeOrder.createMany = vi.fn(async () => {
      intentos += 1;
      return { count: intentos === 1 ? 0 : 1 };
    });

    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });

    expect(r.ok).toBe(true);
    expect(tx.storeOrder.createMany).toHaveBeenCalledTimes(2);
    expect(primerPedido().orderNumber).toBe(5);
    expect(
      (tx.storeOrder.createMany.mock.calls[1] as unknown as [{ data: { orderNumber: number }[] }])[0].data[0]
        .orderNumber,
    ).toBe(6);
  });
});

describe("createStoreOrder — idempotencia", () => {
  it("la misma clave devuelve el mismo pedido y el mismo token, sin crear otro ni rotar el hash", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue({
      id: "ord-existente",
      publicId: "ped_existente",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date("2026-10-04T15:10:00.000Z"),
      buyerEmail: "ana@example.com",
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });

    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });

    expect(r).toEqual({
      ok: true,
      orderId: "ord-existente",
      publicId: "ped_existente",
      accessToken: orderAccessToken("ped_existente", KEY),
    });
    expect(prismaMock.storeOrder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_clientIdempotencyKey: { workspaceId: "ws1", clientIdempotencyKey: "clave-idempotencia-0001" } },
      }),
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si ese pedido ya no espera el pago → error y pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue({
      id: "ord-existente",
      publicId: "ped_existente",
      status: "PAID",
      holdExpiresAt: null,
      buyerEmail: "ana@example.com",
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r).toEqual({ ok: false, error: "Ese pedido ya se procesó.", renewKey: true });
  });

  it("si la retención de ese pedido venció → error y pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue({
      id: "ord-existente",
      publicId: "ped_existente",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date("2026-10-04T14:59:00.000Z"),
      buyerEmail: "ana@example.com",
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.renewKey).toBe(true);
  });

  it("si el carrito no es el mismo de ese pedido → error y pide una clave nueva (no se cobra otro carrito)", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue({
      id: "ord-existente",
      publicId: "ped_existente",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date("2026-10-04T15:10:00.000Z"),
      buyerEmail: "ana@example.com",
      items: [{ productId: "p1", variantId: null, qty: 3 }],
    });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.renewKey).toBe(true);
  });

  it("si el email no es el de ese pedido → error y pide una clave nueva (no se devuelve el pedido de otra persona)", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue({
      id: "ord-existente",
      publicId: "ped_existente",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date("2026-10-04T15:10:00.000Z"),
      buyerEmail: "otra@example.com",
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.renewKey).toBe(true);
    expect(JSON.stringify(r)).not.toContain("ped_existente");
  });

  it("si la clave choca dentro de la transacción (otro pedido con la misma clave), devuelve ese pedido", async () => {
    tx.storeOrder.createMany = vi.fn(async () => ({ count: 0 }));
    tx.storeOrder.findUnique = vi.fn(async () => ({ id: "ord-gemelo" })) as never;
    prismaMock.storeOrder.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "ord-gemelo",
      publicId: "ped_gemelo",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date("2026-10-04T15:15:00.000Z"),
      buyerEmail: "ana@example.com",
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });

    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });

    expect(r).toMatchObject({ ok: true, orderId: "ord-gemelo", publicId: "ped_gemelo" });
    expect(tx.storeOrderItem.createMany).not.toHaveBeenCalled();
  });
});

describe("createStoreOrder — límite por email", () => {
  it("con 3 pedidos vigentes esperando el pago, el cuarto se rechaza", async () => {
    prismaMock.storeOrder.count.mockResolvedValue(3);

    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });

    expect(r).toEqual({
      ok: false,
      error: "Tenés varios pedidos esperando el pago. Terminá uno o esperá unos minutos.",
    });
    expect(prismaMock.storeOrder.count).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws1",
        buyerEmail: "ana@example.com",
        status: "PENDING_PAYMENT",
        holdExpiresAt: { gt: NOW },
      },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("con 2 vigentes, el tercero pasa", async () => {
    prismaMock.storeOrder.count.mockResolvedValue(2);
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r.ok).toBe(true);
  });
});
