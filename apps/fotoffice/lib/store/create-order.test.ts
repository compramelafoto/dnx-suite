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
const { prismaMock, lockStockRows, loadCartCatalog, reservedQtyByKey, orden, quoteShipping, loadAgenciesForOrder, loadCheckoutDeliveryOptions, loadArtworkCartCatalog } = vi.hoisted(() => {
  const orden: string[] = [];
  return {
    orden,
    loadArtworkCartCatalog: vi.fn(),
    quoteShipping: vi.fn(),
    loadAgenciesForOrder: vi.fn(),
    loadCheckoutDeliveryOptions: vi.fn(),
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
vi.mock("./shipping/quote", () => ({ quoteShipping }));
vi.mock("./shipping/checkout-server", () => ({ loadAgenciesForOrder, loadCheckoutDeliveryOptions }));
// Sólo la lectura de la base: las decisiones (`checkArtworkCartLines`) son las de verdad.
vi.mock("./artworks/storefront", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./artworks/storefront")>()),
  loadArtworkCartCatalog,
}));

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
  shownShippingMinor: null,
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

const COTIZACION = {
  method: "HOME",
  source: "CORREO_ARGENTINO",
  baseMinor: 4_000_00,
  surchargeMinor: 500_00,
  totalMinor: 4_500_00,
  serviceName: "Correo Argentino a domicilio",
  package: { weightGrams: 600, lengthCm: 30, widthCm: 20, heightCm: 10 },
  raw: { productName: "Clasico", price: 4000 },
};

const SUCURSAL = {
  id: "SUC-77",
  name: "Sucursal Centro",
  address: "Córdoba 1234",
  city: "Rosario",
  postalCode: "2000",
};

const domicilio: CheckoutInput["delivery"] = {
  method: "HOME",
  address: {
    street: "San Martín",
    number: "1500",
    floorApt: "3 B",
    city: "Rosario",
    provinceCode: "S",
    postalCode: "2000",
    recipientPhone: null,
  },
};

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
  quoteShipping.mockReset().mockImplementation(async () => {
    orden.push("cotizacion");
    return { ok: true, quote: COTIZACION };
  });
  loadAgenciesForOrder.mockReset().mockResolvedValue({ ok: true, agencies: [SUCURSAL] });
  loadCheckoutDeliveryOptions.mockReset().mockResolvedValue({ pickup: true, home: true, branch: true, handlingNote: null });
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
      legalVersion: "2026-10-05",
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

describe("createStoreOrder — envío a domicilio", () => {
  const conTelefono: CheckoutInput = { ...checkoutBase, buyerPhone: "341 555 1234", delivery: domicilio, shownShippingMinor: 4_500_00 };

  it("re-cotiza en el servidor ANTES de la transacción y guarda envío, total y destino", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });

    expect(r.ok).toBe(true);
    expect(orden[0]).toBe("cotizacion");
    expect(quoteShipping).toHaveBeenCalledWith({
      workspaceId: "ws1",
      method: "HOME",
      destination: { postalCode: "2000", provinceCode: "S" },
      items: [{ productId: "p1", variantId: null, qty: 1 }],
    });
    const pedido = primerPedido();
    expect(pedido).toMatchObject({
      deliveryMethod: "SHIPPING",
      shippingMethod: "HOME",
      shippingSource: "CORREO_ARGENTINO",
      subtotalArs: "10000.00",
      shippingArs: "4500.00",
      totalArs: "14500.00",
      shippingAddressJson: {
        recipientName: "Ana Pérez",
        street: "San Martín",
        number: "1500",
        floorApt: "3 B",
        city: "Rosario",
        provinceCode: "S",
        postalCode: "2000",
        recipientPhone: "341 555 1234",
      },
      shippingQuoteJson: {
        method: "HOME",
        source: "CORREO_ARGENTINO",
        baseMinor: 4_000_00,
        surchargeMinor: 500_00,
        totalMinor: 4_500_00,
        serviceName: "Correo Argentino a domicilio",
        package: { weightGrams: 600, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { productName: "Clasico", price: 4000 },
      },
    });
    expect(pedido).not.toHaveProperty("shippingAgencyJson");
  });

  it("si la persona puso otro teléfono para quien recibe, se guarda ése", async () => {
    const otro = {
      ...conTelefono,
      delivery: { method: "HOME" as const, address: { ...domicilio.address, recipientPhone: "11 4444 5555" } },
    } as CheckoutInput;
    await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: otro, now: NOW });
    expect(primerPedido().shippingAddressJson).toMatchObject({ recipientPhone: "11 4444 5555" });
  });

  it("si la cotización falla → error, sin abrir la transacción ni crear el pedido", async () => {
    quoteShipping.mockResolvedValue({ ok: false, reason: "UNAVAILABLE" });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "No pudimos calcular el envío. Probá de nuevo o elegí retiro." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("sin retiro en la sede, la falla no lo sugiere", async () => {
    loadCheckoutDeliveryOptions.mockResolvedValue({ pickup: false, home: true, branch: true, handlingNote: null });
    quoteShipping.mockResolvedValue({ ok: false, reason: "UNAVAILABLE" });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "No pudimos calcular el envío. Probá de nuevo en unos minutos." });
    quoteShipping.mockResolvedValue({ ok: false, reason: "TOO_BIG" });
    const r2 = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r2).toEqual({ ok: false, error: "El paquete es demasiado grande para enviar." });
  });

  it("si cotizar lanza (la base, por ejemplo) → el mismo error, sin pedido y sin datos en el log", async () => {
    quoteShipping.mockRejectedValue(new Error("ana@example.com timeout"));
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "No pudimos calcular el envío. Probá de nuevo o elegí retiro." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("ana@example.com");
  });

  it("sin cobertura → el motivo concreto, sin pedido", async () => {
    quoteShipping.mockResolvedValue({ ok: false, reason: "NO_COVERAGE" });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "Todavía no hacemos envíos a ese código postal." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si la institución no ofrece envío a domicilio → error, sin cotizar ni crear", async () => {
    loadCheckoutDeliveryOptions.mockResolvedValue({ pickup: true, home: false, branch: true, handlingNote: null });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "Ese tipo de envío no está disponible." });
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si la cotización dice que el tipo está apagado → el mismo error", async () => {
    quoteShipping.mockResolvedValue({ ok: false, reason: "DISABLED" });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conTelefono, now: NOW });
    expect(r).toEqual({ ok: false, error: "Ese tipo de envío no está disponible." });
  });
});

describe("createStoreOrder — envío a sucursal", () => {
  const aSucursal = (id = "SUC-77"): CheckoutInput => ({
    ...checkoutBase,
    shownShippingMinor: 3_000_00,
    delivery: {
      method: "BRANCH",
      provinceCode: "S",
      // Lo que manda el navegador NO se usa: se toma la sucursal de la lista de Correo.
      agency: { id, name: "Nombre inventado", address: "Dirección inventada" },
    },
  });

  it("resuelve la sucursal en el servidor, cotiza con su CP y guarda los datos de Correo", async () => {
    quoteShipping.mockResolvedValue({ ok: true, quote: { ...COTIZACION, method: "BRANCH", totalMinor: 3_000_00 } });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: aSucursal(), now: NOW });

    expect(r.ok).toBe(true);
    expect(loadAgenciesForOrder).toHaveBeenCalledWith({ workspaceId: "ws1", provinceCode: "S" });
    expect(quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({ method: "BRANCH", destination: { postalCode: "2000", provinceCode: "S" } }),
    );
    const pedido = primerPedido();
    expect(pedido).toMatchObject({
      deliveryMethod: "SHIPPING",
      shippingMethod: "BRANCH",
      shippingArs: "3000.00",
      totalArs: "13000.00",
      shippingAgencyJson: {
        id: "SUC-77",
        name: "Sucursal Centro",
        address: "Córdoba 1234",
        city: "Rosario",
        postalCode: "2000",
        provinceCode: "S",
      },
    });
    expect(pedido).not.toHaveProperty("shippingAddressJson");
    expect(JSON.stringify(pedido)).not.toContain("inventad");
  });

  it("una sucursal que no está en la lista de Correo → error, sin cotizar ni crear", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: aSucursal("SUC-FALSA"), now: NOW });
    expect(r).toEqual({ ok: false, error: "Esa sucursal ya no está disponible. Elegí otra." });
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si la institución no ofrece sucursal → error, sin listar ni crear", async () => {
    loadCheckoutDeliveryOptions.mockResolvedValue({ pickup: true, home: true, branch: false, handlingNote: null });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: aSucursal(), now: NOW });
    expect(r).toEqual({ ok: false, error: "Ese tipo de envío no está disponible." });
    expect(loadAgenciesForOrder).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("createStoreOrder — sucursal de Andreani (por código postal)", () => {
  const aAndreani = (id = "101"): CheckoutInput => ({
    ...checkoutBase,
    shownShippingMinor: 3_000_00,
    delivery: {
      method: "BRANCH",
      provinceCode: null,
      postalCode: "5000",
      agency: { id, name: "Nombre inventado", address: "Dirección inventada" },
    },
  });
  const ANDREANI_SUC = { id: "101", name: "Córdoba Centro", address: "Colón 100", city: "Córdoba", postalCode: "5000" };

  it("busca la lista con el CP, toma la sucursal del servidor y cotiza a su CP", async () => {
    loadAgenciesForOrder.mockResolvedValue({ ok: true, agencies: [ANDREANI_SUC] });
    quoteShipping.mockResolvedValue({
      ok: true,
      quote: { ...COTIZACION, method: "BRANCH", source: "ANDREANI", serviceName: "Andreani a sucursal", totalMinor: 3_000_00 },
    });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: aAndreani(), now: NOW });

    expect(r.ok).toBe(true);
    expect(loadAgenciesForOrder).toHaveBeenCalledWith({ workspaceId: "ws1", provinceCode: null, postalCode: "5000" });
    expect(quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({ method: "BRANCH", destination: { postalCode: "5000", provinceCode: "" } }),
    );
    const pedido = primerPedido();
    expect(pedido).toMatchObject({
      shippingMethod: "BRANCH",
      shippingSource: "ANDREANI",
      shippingAgencyJson: { id: "101", name: "Córdoba Centro", address: "Colón 100", city: "Córdoba", postalCode: "5000" },
    });
    expect(JSON.stringify(pedido)).not.toContain("inventad");
  });

  it("un id que no está en la lista de ese CP → error, sin cotizar ni crear", async () => {
    loadAgenciesForOrder.mockResolvedValue({ ok: true, agencies: [ANDREANI_SUC] });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: aAndreani("999"), now: NOW });
    expect(r).toEqual({ ok: false, error: "Esa sucursal ya no está disponible. Elegí otra." });
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("createStoreOrder — sucursales cuando Correo falla", () => {
  it("si no se pudo traer la lista (Correo caído), no dice que la sucursal no existe", async () => {
    loadAgenciesForOrder.mockResolvedValue({ ok: false });
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: {
        ...checkoutBase,
        shownShippingMinor: 3_000_00,
        delivery: { method: "BRANCH", provinceCode: "S", agency: { id: "SUC-77", name: "x", address: "y" } },
      },
      now: NOW,
    });
    expect(r).toEqual({ ok: false, error: "No pudimos calcular el envío. Probá de nuevo o elegí retiro." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("createStoreOrder — el envío cambió desde que lo vio", () => {
  const conPrecio = (shown: number | null): CheckoutInput => ({ ...checkoutBase, delivery: domicilio, shownShippingMinor: shown });

  it("si subió: sin pedido, con el precio nuevo para mostrarlo", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conPrecio(4_000_00), now: NOW });
    expect(r).toEqual({
      ok: false,
      error: "El envío cambió: ahora cuesta $ 4.500,00. Revisalo y volvé a confirmar.",
      shippingChanged: { totalMinor: 4_500_00, serviceName: "Correo Argentino a domicilio" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si no lo mandó (envío sin precio visto): se le muestra el precio, sin pedido", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conPrecio(null), now: NOW });
    expect(r).toMatchObject({ ok: false, shippingChanged: { totalMinor: 4_500_00 } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si es igual o bajó: sigue y cobra lo re-cotizado (nunca lo que mandó el navegador)", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: conPrecio(5_000_00), now: NOW });
    expect(r.ok).toBe(true);
    expect(primerPedido()).toMatchObject({ shippingArs: "4500.00", totalArs: "14500.00" });
  });
});

describe("createStoreOrder — envío gratis de la tabla", () => {
  it("una zona de la tabla en $0 se acepta: envío 0, total = subtotal, sigue siendo envío", async () => {
    quoteShipping.mockResolvedValue({ ok: true, quote: { ...COTIZACION, source: "TABLE", baseMinor: 0, surchargeMinor: 0, totalMinor: 0 } });
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, delivery: domicilio, shownShippingMinor: 0 },
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(primerPedido()).toMatchObject({ deliveryMethod: "SHIPPING", shippingSource: "TABLE", shippingArs: "0.00", totalArs: "10000.00" });
  });

  it("Correo en $0 no: no se vende un envío sin precio", async () => {
    quoteShipping.mockResolvedValue({ ok: true, quote: { ...COTIZACION, totalMinor: 0, baseMinor: 0, surchargeMinor: 0 } });
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, delivery: domicilio, shownShippingMinor: 0 },
      now: NOW,
    });
    expect(r).toEqual({ ok: false, error: "No pudimos calcular el envío. Probá de nuevo o elegí retiro." });
  });
});

describe("createStoreOrder — retiro sigue igual", () => {
  it("no cotiza, envío en cero, total = subtotal y sin datos de envío", async () => {
    await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(loadAgenciesForOrder).not.toHaveBeenCalled();
    const pedido = primerPedido();
    expect(pedido).toMatchObject({ deliveryMethod: "PICKUP", shippingArs: "0.00", totalArs: "10000.00" });
    for (const k of ["shippingMethod", "shippingSource", "shippingAddressJson", "shippingAgencyJson", "shippingQuoteJson"]) {
      expect(pedido).not.toHaveProperty(k);
    }
  });
});

describe("createStoreOrder — idempotencia con envío", () => {
  const existenteDomicilio = (over: Record<string, unknown> = {}) => ({
    id: "ord-existente",
    publicId: "ped_existente",
    status: "PENDING_PAYMENT",
    holdExpiresAt: new Date("2026-10-04T15:10:00.000Z"),
    buyerEmail: "ana@example.com",
    items: [{ productId: "p1", variantId: null, qty: 1 }],
    deliveryMethod: "SHIPPING",
    shippingMethod: "HOME",
    shippingAddressJson: { street: "San Martín", number: "1500", floorApt: "3 B", city: "Rosario", provinceCode: "S", postalCode: "2000" },
    shippingAgencyJson: null,
    ...over,
  });

  it("mismo destino → el mismo pedido, sin volver a cotizar", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(existenteDomicilio());
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, delivery: domicilio },
      now: NOW,
    });
    expect(r).toMatchObject({ ok: true, orderId: "ord-existente" });
    expect(quoteShipping).not.toHaveBeenCalled();
  });

  it("otra dirección → pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(
      existenteDomicilio({ shippingAddressJson: { street: "San Martín", number: "900", provinceCode: "S", postalCode: "2000" } }),
    );
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, delivery: domicilio },
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, renewKey: true });
    expect(JSON.stringify(r)).not.toContain("ped_existente");
  });

  it("otro piso o depto (o localidad) → pide una clave nueva", async () => {
    for (const cambio of [{ floorApt: "4 C" }, { city: "Funes" }]) {
      prismaMock.storeOrder.findUnique.mockResolvedValue(
        existenteDomicilio({
          shippingAddressJson: { street: "San Martín", number: "1500", floorApt: "3 B", city: "Rosario", provinceCode: "S", postalCode: "2000", ...cambio },
        }),
      );
      const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, delivery: domicilio }, now: NOW });
      expect(r).toMatchObject({ ok: false, renewKey: true });
    }
  });

  it("antes retiro y ahora envío → pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(
      existenteDomicilio({ deliveryMethod: "PICKUP", shippingMethod: null, shippingAddressJson: null }),
    );
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, delivery: domicilio },
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, renewKey: true });
  });

  it("otra sucursal → pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(
      existenteDomicilio({ shippingMethod: "BRANCH", shippingAddressJson: null, shippingAgencyJson: { id: "SUC-1" } }),
    );
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: {
        ...checkoutBase,
        delivery: { method: "BRANCH", provinceCode: "S", agency: { id: "SUC-2", name: "x", address: "y" } },
      },
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, renewKey: true });
  });

  it("antes envío y ahora retiro → pide una clave nueva", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(existenteDomicilio());
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: checkoutBase, now: NOW });
    expect(r).toMatchObject({ ok: false, renewKey: true });
  });
});

// ── Obras de concursos (etapa 3, Task 9) ────────────────────────────────────

describe("createStoreOrder — obras", () => {
  type Obra = import("./artworks/storefront").PublicArtworkDetail;
  const obra = (over: Partial<Obra> = {}): Obra => ({
    listingId: "al1",
    slug: "atardecer",
    title: "Atardecer",
    authorDisplayName: "Juana",
    awardLabel: null,
    contestTitle: "Salón 2026",
    imageUrl: "https://r2/al1.jpg",
    previewWidth: 1600,
    previewHeight: 1067,
    fromPriceMinor: 25_000_00,
    formats: [{ id: "f1", name: "Copia", kind: "PRINT", widthCm: 30, heightCm: 45, priceMinor: 25_000_00, needsBorders: false }],
    ...over,
  });
  const lineaObra = { kind: "artwork" as const, artworkListingId: "al1", printFormatId: "f1", qty: 2 };

  /** El `tx` del pedido con lo que leen y bloquean las obras; cada SQL crudo deja su marca en `orden`. */
  function txConObras(opts: { authorUserId?: number | null; royaltyBps?: number | null } = {}) {
    return Object.assign(orderTx(), {
      $queryRaw: vi.fn(async (q: { sql: string }) => {
        if (q.sql.includes('"ArtworkConsent"')) {
          orden.push("bloqueo-permisos");
          return [{ entryId: "e1", authorUserId: 55 }];
        }
        if (q.sql.includes('"ArtworkListing"')) {
          orden.push("bloqueo-fichas");
          return [{ id: "al1" }];
        }
        throw new Error(`SQL inesperado: ${q.sql}`);
      }),
      artworkListing: {
        findMany: vi.fn(async () => [
          { id: "al1", contestId: "c1", entryId: "e1", entry: { authorUserId: opts.authorUserId === undefined ? 77 : opts.authorUserId } },
        ]),
      },
      contestStoreSettings: {
        findMany: vi.fn(async () =>
          opts.royaltyBps === null ? [] : [{ contestId: "c1", royaltyBps: opts.royaltyBps ?? 1500 }],
        ),
      },
    });
  }

  function renglones() {
    return (tx.storeOrderItem.createMany.mock.calls[0] as unknown as [{ data: Record<string, unknown>[] }])[0].data;
  }

  let txo: ReturnType<typeof txConObras>;

  beforeEach(() => {
    tx = txo = txConObras();
    loadArtworkCartCatalog.mockReset().mockImplementation(async (_ws: string, _ids: string[], db?: unknown) => {
      orden.push(db ? "obras-en-tx" : "obras-previas");
      return new Map([["al1", obra()]]);
    });
  });

  it("carrito mixto: un pedido con el producto y la obra, total y subtotal con las dos", async () => {
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [{ productId: "p1", variantId: null, qty: 1 }, lineaObra] },
      now: NOW,
    });

    expect(r.ok).toBe(true);
    // 10.000 de la remera + 2 × 25.000 de la obra; retiro: sin envío.
    expect(primerPedido()).toMatchObject({ subtotalArs: "60000.00", shippingArs: "0.00", totalArs: "60000.00" });
    expect(renglones()).toEqual([
      expect.objectContaining({ productId: "p1", qty: 1, lineTotalArs: "10000.00" }),
      {
        orderId: "ord1",
        productId: null,
        variantId: null,
        productName: "Atardecer",
        variantName: "Copia (30 × 45 cm)",
        productSlug: "atardecer",
        imageUrl: "https://r2/al1.jpg",
        qty: 2,
        unitPriceArs: "25000.00",
        lineTotalArs: "50000.00",
        artworkListingId: "al1",
        printFormatId: "f1",
        printFormatName: "Copia (30 × 45 cm)",
        royaltyBps: 1500,
        artworkAuthorUserId: 77,
      },
    ]);
    // El producto sigue su camino (bloqueo de stock); la obra, el suyo.
    expect(lockStockRows).toHaveBeenCalledWith(tx, { workspaceId: "ws1", productIds: ["p1"], variantIds: [] });
  });

  it("sólo obras: no bloquea stock ni lee retenciones (no tienen stock)", async () => {
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: [lineaObra] }, now: NOW });

    expect(r.ok).toBe(true);
    expect(lockStockRows).not.toHaveBeenCalled();
    expect(reservedQtyByKey).not.toHaveBeenCalled();
    expect(loadCartCatalog).not.toHaveBeenCalled();
    expect(primerPedido()).toMatchObject({ subtotalArs: "50000.00", totalArs: "50000.00" });
  });

  it("en la transacción bloquea permisos y después fichas, y recién ahí vuelve a decidir", async () => {
    await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: [lineaObra] }, now: NOW });

    expect(orden).toEqual(["obras-previas", "bloqueo-permisos", "bloqueo-fichas", "obras-en-tx"]);
    expect(loadArtworkCartCatalog).toHaveBeenLastCalledWith("ws1", ["al1"], tx);
    const sqls = (txo.$queryRaw.mock.calls as unknown as [{ text: string; values: unknown[] }][]).map(([q]) => q);
    expect(sqls[0].text).toMatch(/FROM "ArtworkConsent" WHERE "workspaceId" = \$1 AND "entryId" = ANY\(\$2::text\[\]\) ORDER BY "id" FOR UPDATE/);
    expect(sqls[0].values).toEqual(["ws1", ["e1"]]);
    expect(sqls[1].text).toMatch(/FROM "ArtworkListing" WHERE "workspaceId" = \$1 AND "id" = ANY\(\$2::text\[\]\) ORDER BY "id" FOR UPDATE/);
    expect(sqls[1].values).toEqual(["ws1", ["al1"]]);
    expect(txo.artworkListing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws1", id: { in: ["al1"] } } }));
    expect(txo.contestStoreSettings.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws1", contestId: { in: ["c1"] } } }));
  });

  it("el precio es el del formato leído en la transacción, nunca uno del navegador", async () => {
    loadArtworkCartCatalog.mockImplementation(async (_ws: string, _ids: string[], db?: unknown) =>
      new Map([["al1", db ? obra({ formats: [{ ...obra().formats[0], priceMinor: 26_500_00 }] }) : obra()]]),
    );
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      // Basura que el navegador podría mandar: no se usa.
      checkout: { ...checkoutBase, lines: [{ ...lineaObra, qty: 1, unitPriceMinor: 1 } as typeof lineaObra] },
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(renglones()[0]).toMatchObject({ unitPriceArs: "26500.00", lineTotalArs: "26500.00" });
    expect(primerPedido()).toMatchObject({ totalArs: "26500.00" });
  });

  it("obra despublicada, retirada o de un concurso no vinculado → error antes de cotizar, sin pedido", async () => {
    loadArtworkCartCatalog.mockResolvedValue(new Map());
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [lineaObra], delivery: domicilio, shownShippingMinor: 4_500_00 },
      now: NOW,
    });
    expect(r).toEqual({
      ok: false,
      error: "Una de las obras ya no está disponible.",
      problems: [{ key: "a:al1:f1", message: "Una obra ya no está a la venta." }],
    });
    expect(quoteShipping).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("formato inactivo o que la resolución no alcanza → error, sin pedido", async () => {
    loadArtworkCartCatalog.mockResolvedValue(new Map([["al1", obra({ formats: [{ ...obra().formats[0], id: "f2" }] })]]));
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: [lineaObra] }, now: NOW });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("Una de las obras ya no está disponible.");
    expect(r.problems?.[0]?.message).toMatch(/formato elegido de Atardecer/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("el autor retira el permiso mientras compra (la relectura bloqueada ya no la vende) → error, sin pedido", async () => {
    loadArtworkCartCatalog.mockImplementation(async (_ws: string, _ids: string[], db?: unknown) =>
      db ? new Map() : new Map([["al1", obra()]]),
    );
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [{ productId: "p1", variantId: null, qty: 1 }, lineaObra] },
      now: NOW,
    });
    expect(r).toMatchObject({ ok: false, error: "Una de las obras ya no está disponible." });
    expect(!r.ok && r.problems).toEqual([{ key: "a:al1:f1", message: "Una obra ya no está a la venta." }]);
    expect(tx.storeOrder.createMany).not.toHaveBeenCalled();
    expect(tx.storeOrderItem.createMany).not.toHaveBeenCalled();
  });

  it("más de 20 copias de la misma obra y formato (sumando renglones) → error, sin pedido", async () => {
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: { ...checkoutBase, lines: [{ ...lineaObra, qty: 15 }, { ...lineaObra, qty: 10 }] },
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("concurso sin ajustes → regalía 20 %; obra sin autor en FotoRank → el del permiso", async () => {
    tx = txo = txConObras({ royaltyBps: null, authorUserId: null });
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: [lineaObra] }, now: NOW });
    expect(r.ok).toBe(true);
    expect(renglones()[0]).toMatchObject({ royaltyBps: 2000, artworkAuthorUserId: 55 });
  });

  it("con envío: cotiza la obra por su formato", async () => {
    const r = await createStoreOrder({
      workspaceId: "ws1",
      memberId: null,
      checkout: {
        ...checkoutBase,
        lines: [{ productId: "p1", variantId: null, qty: 1 }, lineaObra],
        delivery: domicilio,
        shownShippingMinor: 4_500_00,
      },
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect(quoteShipping).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { productId: "p1", variantId: null, qty: 1 },
          { kind: "artwork", printFormatId: "f1", qty: 2 },
        ],
      }),
    );
    // El envío no es base de nada: subtotal = productos + obras; total = subtotal + envío.
    expect(primerPedido()).toMatchObject({ subtotalArs: "60000.00", shippingArs: "4500.00", totalArs: "64500.00" });
  });
});

describe("createStoreOrder — idempotencia con obras", () => {
  const existente = (items: unknown[]) => ({
    id: "ord-existente",
    publicId: "ped_existente",
    status: "PENDING_PAYMENT",
    holdExpiresAt: new Date("2026-10-04T15:10:00.000Z"),
    buyerEmail: "ana@example.com",
    items,
    deliveryMethod: "PICKUP",
    shippingMethod: null,
    shippingAddressJson: null,
    shippingAgencyJson: null,
  });
  const lineas = [
    { productId: "p1", variantId: null, qty: 1 },
    { kind: "artwork" as const, artworkListingId: "al1", printFormatId: "f1", qty: 2 },
  ];
  const guardados = [
    { productId: "p1", variantId: null, artworkListingId: null, printFormatId: null, qty: 1 },
    { productId: null, variantId: null, artworkListingId: "al1", printFormatId: "f1", qty: 2 },
  ];

  beforeEach(() => {
    loadArtworkCartCatalog.mockReset();
  });

  it("la misma compra (producto + obra en su formato) → el mismo pedido, sin volver a validar", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(existente(guardados));
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: lineas }, now: NOW });
    expect(r).toMatchObject({ ok: true, orderId: "ord-existente" });
    expect(loadArtworkCartCatalog).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("otro formato, otra cantidad o sin la obra → pide una clave nueva", async () => {
    for (const cambio of [
      [lineas[0], { ...lineas[1], printFormatId: "f2" }],
      [lineas[0], { ...lineas[1], qty: 3 }],
      [lineas[0]],
    ]) {
      prismaMock.storeOrder.findUnique.mockResolvedValue(existente(guardados));
      const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: cambio }, now: NOW });
      expect(r).toMatchObject({ ok: false, renewKey: true });
    }
  });

  it("un renglón de obra no se confunde con un producto ni con una obra borrada", async () => {
    prismaMock.storeOrder.findUnique.mockResolvedValue(
      existente([guardados[0], { productId: null, variantId: null, artworkListingId: null, printFormatId: null, qty: 2 }]),
    );
    const r = await createStoreOrder({ workspaceId: "ws1", memberId: null, checkout: { ...checkoutBase, lines: lineas }, now: NOW });
    expect(r).toMatchObject({ ok: false, renewKey: true });
  });
});
