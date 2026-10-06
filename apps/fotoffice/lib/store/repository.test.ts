import { beforeEach, describe, expect, it, vi } from "vitest";

const { item, listing, branding, settings, category, moduleEnabledMock, obras } = vi.hoisted(() => ({
  obras: {
    link: { findMany: vi.fn() },
    listing: { findMany: vi.fn() },
    format: { findMany: vi.fn() },
    print: { findUnique: vi.fn() },
    consent: { findMany: vi.fn() },
  },
  item: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  listing: { findMany: vi.fn(), findFirst: vi.fn() },
  branding: { findUnique: vi.fn() },
  settings: { findUnique: vi.fn() },
  moduleEnabledMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    storeOrderItem: item,
    productStoreListing: listing,
    fotofficeWorkspaceBranding: branding,
    storeSettings: settings,
    productCategory: category,
    workspaceContestOrganizationLink: obras.link,
    artworkListing: obras.listing,
    printFormat: obras.format,
    storePrintSettings: obras.print,
    artworkConsent: obras.consent,
  },
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduleEnabledMock }));

const { reservedQtyByKey, loadOpenStore, listStoreProducts, listStoreCategories, getStoreProduct, validateCartLines } =
  await import(
  "./repository"
);

const dec = (s: string) => ({ toString: () => s });
const fila = (o: Record<string, unknown> = {}) => ({
  slug: "remera",
  onlineTitle: null,
  onlineDescription: null,
  sizeChartImageUrl: null,
  maxPerOrder: null,
  product: {
    id: "p1",
    name: "Remera",
    description: null,
    priceArs: dec("100.00"),
    tracksStock: true,
    stockQty: 3,
    imageUrl: null,
    category: null,
    _count: { variants: 0 },
    images: [],
    variants: [],
  },
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  item.findMany.mockResolvedValue([]);
});

describe("reservedQtyByKey", () => {
  const now = new Date("2026-10-04T15:00:00Z");

  it("suma sólo pedidos esperando el pago con la retención vigente, del workspace", async () => {
    item.findMany.mockResolvedValueOnce([
      { productId: "p1", variantId: null, qty: 2 },
      { productId: "p1", variantId: "v1", qty: 1 },
      { productId: "p1", variantId: null, qty: 1 },
    ]);
    const m = await reservedQtyByKey("ws-1", undefined, { now });
    expect(m).toEqual(
      new Map([
        ["p1:-", 3],
        ["p1:v1", 1],
      ]),
    );
    expect(item.findMany).toHaveBeenCalledWith({
      where: { order: { workspaceId: "ws-1", status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } } },
      select: { productId: true, variantId: true, qty: true },
    });
  });

  it("puede excluir un pedido (el pago que se acredita no se cuenta a sí mismo)", async () => {
    const db = { storeOrderItem: { findMany: vi.fn().mockResolvedValue([]) } };
    await reservedQtyByKey("ws-1", db as never, { excludeOrderId: "o9", now });
    expect(db.storeOrderItem.findMany).toHaveBeenCalledWith({
      where: {
        order: { workspaceId: "ws-1", status: "PENDING_PAYMENT", holdExpiresAt: { gt: now }, id: { not: "o9" } },
      },
      select: { productId: true, variantId: true, qty: true },
    });
    expect(item.findMany).not.toHaveBeenCalled();
  });

  it("sin `now` usa la hora actual", async () => {
    await reservedQtyByKey("ws-1");
    const where = item.findMany.mock.calls[0][0].where;
    expect(where.order.holdExpiresAt.gt).toBeInstanceOf(Date);
  });
});

describe("loadOpenStore", () => {
  it("null si no hay institución, módulo apagado o tienda cerrada", async () => {
    branding.findUnique.mockResolvedValueOnce(null);
    expect(await loadOpenStore("nada")).toBeNull();

    branding.findUnique.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "sfpr", commercialName: "SFPR" });
    moduleEnabledMock.mockResolvedValueOnce(false);
    expect(await loadOpenStore("sfpr")).toBeNull();

    // Tienda encendida pero Ventas apagado: la tienda no tiene qué vender.
    moduleEnabledMock.mockImplementation(async (_ws: string, key: string) => key === "store");
    expect(await loadOpenStore("sfpr")).toBeNull();
    expect(settings.findUnique).not.toHaveBeenCalled();

    moduleEnabledMock.mockReset();
    moduleEnabledMock.mockResolvedValue(true);
    settings.findUnique.mockResolvedValueOnce(null);
    expect(await loadOpenStore("sfpr")).toBeNull();
    settings.findUnique.mockResolvedValueOnce({ isOpen: false });
    expect(await loadOpenStore("sfpr")).toBeNull();
  });

  it("abierta: devuelve la institución y la configuración", async () => {
    branding.findUnique.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "sfpr", commercialName: "SFPR" });
    moduleEnabledMock.mockResolvedValue(true);
    const s = { isOpen: true, pickupAddress: "Calle 1" };
    settings.findUnique.mockResolvedValueOnce(s);
    expect(await loadOpenStore("sfpr")).toEqual({
      workspace: { id: "ws-1", slug: "sfpr", name: "SFPR" },
      settings: s,
    });
    expect(moduleEnabledMock).toHaveBeenCalledWith("ws-1", "store");
    expect(moduleEnabledMock).toHaveBeenCalledWith("ws-1", "sales");
  });
});

describe("consultas del catálogo público", () => {
  it("listStoreProducts filtra por workspace, venta online, activo y categoría", async () => {
    listing.findMany.mockResolvedValueOnce([fila()]);
    const cards = await listStoreProducts("ws-1", { categoryId: "c1" });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ productId: "p1", fromPriceMinor: 10000, soldOut: false });
    const args = listing.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      workspaceId: "ws-1",
      sellOnline: true,
      product: { workspaceId: "ws-1", isActive: true, categoryId: "c1" },
    });
    expect(args.orderBy).toEqual([{ sortOrder: "asc" }, { product: { name: "asc" } }]);
    expect(args.select.product.select.variants.where).toEqual({ isActive: true });
  });

  it("listStoreProducts deja afuera un producto con talles todos inactivos", async () => {
    listing.findMany.mockResolvedValueOnce([fila({ product: { ...fila().product, _count: { variants: 2 } } })]);
    expect(await listStoreProducts("ws-1")).toEqual([]);
  });

  it("getStoreProduct: null si todos sus talles están inactivos", async () => {
    listing.findFirst.mockResolvedValueOnce(fila({ product: { ...fila().product, _count: { variants: 1 } } }));
    expect(await getStoreProduct("ws-1", "remera")).toBeNull();
  });

  it("getStoreProduct: null si no existe; si existe, la ficha con reservas", async () => {
    listing.findFirst.mockResolvedValueOnce(null);
    expect(await getStoreProduct("ws-1", "nada")).toBeNull();

    listing.findFirst.mockResolvedValueOnce(fila());
    item.findMany.mockResolvedValueOnce([{ productId: "p1", variantId: null, qty: 2 }]);
    const d = await getStoreProduct("ws-1", "remera");
    expect(d?.available).toBe(1);
    expect(listing.findFirst.mock.calls[1][0].where).toEqual({
      workspaceId: "ws-1",
      slug: "remera",
      sellOnline: true,
      product: { workspaceId: "ws-1", isActive: true },
    });
  });

  it("validateCartLines busca sólo los productos del carrito y revalida", async () => {
    listing.findMany.mockResolvedValueOnce([fila()]);
    const r = await validateCartLines("ws-1", [
      { productId: "p1", variantId: null, qty: 5 },
      { productId: "px", variantId: null, qty: 1 },
    ]);
    expect(r.lines.map((l) => [l.key, l.qty])).toEqual([["p1:-", 3]]);
    expect(r.problems.map((p) => p.key)).toEqual(["p1:-", "px:-"]);
    expect(listing.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: "ws-1",
      sellOnline: true,
      productId: { in: ["p1", "px"] },
      product: { workspaceId: "ws-1", isActive: true },
    });
  });

  it("listStoreCategories: sólo categorías activas con algún producto público", async () => {
    category.findMany.mockResolvedValueOnce([{ id: "c1", name: "Remeras" }]);
    expect(await listStoreCategories("ws-1")).toEqual([{ id: "c1", name: "Remeras" }]);
    expect(category.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: "ws-1",
      isActive: true,
      products: { some: { workspaceId: "ws-1", isActive: true, storeListing: { is: { sellOnline: true } } } },
    });
  });

  it("validateCartLines con obras: las revisa con sus reglas y devuelve en el orden del carrito", async () => {
    listing.findMany.mockResolvedValueOnce([fila()]);
    obras.link.findMany.mockResolvedValueOnce([{ organizationId: "org1" }]);
    obras.listing.findMany.mockResolvedValueOnce([
      {
        id: "l1",
        slug: "atardecer",
        status: "PUBLISHED",
        entryId: "e1",
        title: "Atardecer",
        authorDisplayName: null,
        awardLabel: null,
        previewUrl: "https://r2/l1.jpg",
        previewWidth: 1600,
        previewHeight: 1067,
        originalWidth: 6000,
        originalHeight: 4000,
        contest: { id: "c1", slug: "salon", title: "Salón", organizationId: "org1" },
      },
    ]);
    obras.format.findMany.mockResolvedValueOnce([
      { id: "f1", name: "Copia 30 × 45", kind: "PRINT", widthCm: 30, heightCm: 45, priceArs: dec("45000.00"), isActive: true },
    ]);
    obras.print.findUnique.mockResolvedValueOnce(null);
    obras.consent.findMany.mockResolvedValueOnce([{ entryId: "e1", basis: "RULES", status: "NOTIFIED", notifiedAt: new Date() }]);

    const r = await validateCartLines("ws-1", [
      { kind: "artwork", artworkListingId: "lx", printFormatId: "f1", qty: 1, name: "Vieja" },
      { productId: "p1", variantId: null, qty: 1 },
      { kind: "artwork", artworkListingId: "l1", printFormatId: "f1", qty: 2, unitPriceMinor: 1 },
    ]);
    expect(r.lines.map((l) => [l.key, l.qty, l.unitPriceMinor])).toEqual([
      ["p1:-", 1, 10000],
      ["a:l1:f1", 2, 4500000],
    ]);
    expect(r.problems.map((p) => p.key)).toEqual(["a:lx:f1", "a:l1:f1"]);
    expect(obras.listing.findMany.mock.calls[0][0].where).toMatchObject({
      workspaceId: "ws-1",
      status: "PUBLISHED",
      id: { in: ["lx", "l1"] },
    });
  });

  it("validateCartLines sólo con obras no consulta productos", async () => {
    obras.link.findMany.mockResolvedValueOnce([]);
    const r = await validateCartLines("ws-1", [{ kind: "artwork", artworkListingId: "l1", printFormatId: "f1", qty: 1 }]);
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual([{ key: "a:l1:f1", message: "Una obra ya no está a la venta." }]);
    expect(listing.findMany).not.toHaveBeenCalled();
    expect(item.findMany).not.toHaveBeenCalled();
  });

  it("validateCartLines con carrito vacío no consulta", async () => {
    expect(await validateCartLines("ws-1", [])).toEqual({ lines: [], problems: [] });
    expect(listing.findMany).not.toHaveBeenCalled();
  });
});
