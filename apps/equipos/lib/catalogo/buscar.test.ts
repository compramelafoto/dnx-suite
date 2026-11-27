import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  listingFindMany: vi.fn(),
  listingCount: vi.fn(),
  viewUpsert: vi.fn(),
  reportFindFirst: vi.fn(),
  signed: vi.fn(),
  ratingGroupBy: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListing: { findFirst: m.listingFindFirst, findMany: m.listingFindMany, count: m.listingCount },
    gearListingView: { upsert: m.viewUpsert },
    stolenGearReport: { findFirst: m.reportFindFirst },
    gearSaleRating: { groupBy: m.ratingGroupBy },
  },
}));
vi.mock("@/lib/archivos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archivos")>("@/lib/archivos");
  return { ...actual, getSignedFileUrl: m.signed };
});
vi.mock("@/lib/correo", () => ({ sendPortalEmail: vi.fn() }));

import {
  formatDolares,
  formatPesos,
  getPublicListing,
  getPublicListingsByIds,
  parseCatalogFilters,
  recordView,
  searchListings,
} from "./buscar";

function listingConVendedor(
  seller: Record<string, unknown> = { name: "Ana Pérez" },
  over: Record<string, unknown> = {},
) {
  return {
    id: 5,
    sellerId: 33,
    gearItemId: 77,
    status: "PUBLISHED",
    kind: "BODY",
    make: "Canon",
    model: "EOS R6",
    mount: "Canon RF",
    priceArs: 1850000,
    priceUsdRef: 1500,
    condition: "VERY_GOOD",
    description: "Poco uso",
    accessories: "Correa",
    province: "Santa Fe",
    city: "Rafaela",
    serialPhotoKey: "equipos/1/serie.jpg",
    declaredFirstOwner: true,
    includesCharger: true,
    batteriesCount: 2,
    includesManual: false,
    includesBox: false,
    usageSeal: "NONE",
    usageSince: null,
    usagePhotosCount: null,
    reviewNote: "nota interna",
    publishedAt: new Date("2026-11-20T12:00:00Z"),
    createdAt: new Date("2026-11-19T12:00:00Z"),
    seller,
    gearItem: {
      ownerId: 33,
      photoKeys: ["equipos/1/a.jpg", "equipos/1/serie.jpg", "equipos/1/b.jpg"],
      serialNormalized: "ABC123456",
      purchaseProofKey: "equipos/1/factura.pdf",
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.signed.mockImplementation(async (k: string) => `https://firmada/${k}`);
  m.reportFindFirst.mockResolvedValue(null);
  m.ratingGroupBy.mockResolvedValue([]);
});

describe("parseCatalogFilters", () => {
  it("filtros inválidos se ignoran", () => {
    expect(
      parseCatalogFilters({ kind: "AVION", minPrice: "-3", province: "Narnia", page: "0" }),
    ).toEqual({ page: 1 });
  });

  it("toma los filtros válidos", () => {
    expect(
      parseCatalogFilters({
        kind: "LENS",
        make: "  canon ",
        mount: "Canon RF",
        minPrice: "100000",
        maxPrice: "2000000",
        province: "Santa Fe",
        page: "3",
      }),
    ).toEqual({
      kind: "LENS",
      make: "canon",
      mount: "Canon RF",
      minPrice: 100000,
      maxPrice: 2000000,
      province: "Santa Fe",
      page: 3,
    });
  });

  it("precios con decimales, montura fuera de la lista y página no numérica se ignoran", () => {
    expect(
      parseCatalogFilters({ minPrice: "10.5", maxPrice: "abc", mount: "Leica M", page: "x", make: "" }),
    ).toEqual({ page: 1 });
  });

  it("precios fuera del rango de la base se ignoran", () => {
    expect(parseCatalogFilters({ minPrice: "99999999999" })).toEqual({ page: 1 });
    expect(parseCatalogFilters({ maxPrice: "2147483648" })).toEqual({ page: 1 });
    expect(parseCatalogFilters({ maxPrice: "2147483647" })).toEqual({ maxPrice: 2147483647, page: 1 });
  });

  it("una página mayor a 1000 se ignora y queda la primera", () => {
    expect(parseCatalogFilters({ page: "99999999" })).toEqual({ page: 1 });
    expect(parseCatalogFilters({ page: "1001" })).toEqual({ page: 1 });
    expect(parseCatalogFilters({ page: "1000" })).toEqual({ page: 1000 });
  });

  it("si llega un valor repetido usa el primero", () => {
    expect(parseCatalogFilters({ kind: ["BODY", "LENS"] })).toEqual({ kind: "BODY", page: 1 });
  });
});

describe("getPublicListing", () => {
  it("el objeto público no trae datos del vendedor ni la serie completa", async () => {
    m.listingFindFirst.mockResolvedValue(
      listingConVendedor({ email: "v@x.com", phone: "+5493415550000", name: "Ana Pérez" }),
    );
    const l = await getPublicListing(5);
    const json = JSON.stringify(l);
    for (const filtrado of [
      "v@x.com",
      "5550000",
      "Pérez",
      "ABC123456",
      "sellerId",
      "ownerId",
      "factura.pdf",
      "nota interna",
      "purchaseProofKey",
      "reviewNote",
    ]) {
      expect(json).not.toContain(filtrado);
    }
    expect(l?.sellerFirstName).toBe("Ana");
    expect(l?.serialMasked).toBe("••••3456");
    expect(l?.sellerVerified).toBe(true);
  });

  it("una publicación pausada o en revisión no se muestra", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    expect(await getPublicListing(5)).toBeNull();
    const args = m.listingFindFirst.mock.calls[0][0];
    expect(args.where).toEqual({
      id: 5,
      status: "PUBLISHED",
      seller: { identityVerification: { is: { status: "APPROVED" } } },
    });
  });

  it("con una denuncia activa de otra persona sobre la serie no se muestra (revisión en vivo)", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    m.reportFindFirst.mockResolvedValue({ id: 3 });
    expect(await getPublicListing(5)).toBeNull();
    expect(m.reportFindFirst.mock.calls[0][0].where).toEqual({
      serialNormalized: "ABC123456",
      status: "ACTIVE",
      reporterId: { not: 33 },
    });
    expect(m.signed).not.toHaveBeenCalled();
  });

  it("sin denuncia activa muestra la línea «Sin denuncias…»", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    const l = await getPublicListing(5);
    expect(l?.trust.verified[1]).toMatch(/^Sin denuncias de robo ni pérdida en el portal \(revisado el /);
  });

  it("del vendedor sólo pide el nombre y del equipo sólo fotos, serie y si hay factura", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    await getPublicListing(5);
    const { select } = m.listingFindFirst.mock.calls[0][0];
    expect(select.seller).toEqual({ select: { name: true } });
    expect(select.gearItem).toEqual({
      select: { photoKeys: true, serialNormalized: true, purchaseProofKey: true },
    });
    expect(select.reviewNote).toBeUndefined();
    // `sellerId` se lee para revisar denuncias de otras personas, pero nunca sale en el objeto
    // público (lo cubre «el objeto público no trae datos del vendedor»).
  });

  it("calcula la confianza con la factura y sin disparos verificados", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    const l = await getPublicListing(5);
    expect(l?.trust.level).toBe("BUENO");
    expect(l?.trust.verified).toContain("Factura de compra presentada");
    expect(l?.trust.verified[0]).toBe("Identidad del vendedor verificada");
    expect(l?.shutterText).toBe("Cantidad de disparos: no verificada");
    expect(l?.declared).toEqual(["Primer dueño", "Incluye cargador", "2 baterías"]);
  });

  it("las fotos van firmadas por una hora y sin la foto del número de serie", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    const l = await getPublicListing(5);
    expect(l?.photoUrls).toEqual(["https://firmada/equipos/1/a.jpg", "https://firmada/equipos/1/b.jpg"]);
    expect(m.signed).toHaveBeenCalledWith("equipos/1/a.jpg", 3600);
    expect(m.signed).not.toHaveBeenCalledWith("equipos/1/serie.jpg", expect.anything());
  });

  it("si el almacenamiento falla sigue sin fotos", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.signed.mockRejectedValue(new Error("sin bucket"));
    m.listingFindFirst.mockResolvedValue(listingConVendedor());
    const l = await getPublicListing(5);
    expect(l?.photoUrls).toEqual([]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("sin nombre el vendedor es «Vendedor» y el nombre lleva mayúscula inicial", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor({ name: null }));
    expect((await getPublicListing(5))?.sellerFirstName).toBe("Vendedor");
    m.listingFindFirst.mockResolvedValue(listingConVendedor({ name: "  ana   pérez" }));
    expect((await getPublicListing(5))?.sellerFirstName).toBe("Ana");
  });

  it("un lente no muestra línea de disparos", async () => {
    m.listingFindFirst.mockResolvedValue(listingConVendedor(undefined, { kind: "LENS" }));
    expect((await getPublicListing(5))?.shutterText).toBeNull();
  });
});

describe("searchListings", () => {
  it("sólo publicadas, 24 por página, más nuevas primero y marca sin distinguir mayúsculas", async () => {
    m.listingFindMany.mockResolvedValue([listingConVendedor()]);
    m.listingCount.mockResolvedValue(30);
    const r = await searchListings({
      make: "canon",
      kind: "BODY",
      mount: "Canon RF",
      province: "Santa Fe",
      minPrice: 1000,
      maxPrice: 2000000,
      page: 2,
    });
    const args = m.listingFindMany.mock.calls[0][0];
    expect(args.where).toEqual({
      status: "PUBLISHED",
      seller: { identityVerification: { is: { status: "APPROVED" } } },
      kind: "BODY",
      make: { contains: "canon", mode: "insensitive" },
      mount: "Canon RF",
      province: "Santa Fe",
      priceArs: { gte: 1000, lte: 2000000 },
    });
    expect(args.take).toBe(24);
    expect(args.skip).toBe(24);
    expect(args.orderBy).toEqual([{ publishedAt: "desc" }, { id: "desc" }]);
    expect(m.listingCount.mock.calls[0][0]).toEqual({ where: args.where });
    expect(r.total).toBe(30);
    expect(r.items).toHaveLength(1);
    expect(JSON.stringify(r.items)).not.toContain("ABC123456");
  });

  it("trae sellerRating con UNA sola consulta de calificaciones para toda la página", async () => {
    m.listingFindMany.mockResolvedValue([
      listingConVendedor(),
      { ...listingConVendedor(), id: 6 },
      { ...listingConVendedor(), id: 7, sellerId: 34 },
    ]);
    m.listingCount.mockResolvedValue(3);
    m.ratingGroupBy.mockResolvedValue([{ ratedId: 33, _avg: { score: 4.5 }, _count: { _all: 12 } }]);
    const r = await searchListings({ page: 1 });
    expect(m.ratingGroupBy).toHaveBeenCalledOnce();
    expect(r.items.map((i) => i.sellerRating)).toEqual([
      { average: 4.5, count: 12 },
      { average: 4.5, count: 12 },
      { average: null, count: 0 },
    ]);
  });

  it("sin filtros sólo pide las publicadas", async () => {
    m.listingFindMany.mockResolvedValue([]);
    m.listingCount.mockResolvedValue(0);
    await searchListings({ page: 1 });
    expect(m.listingFindMany.mock.calls[0][0].where).toEqual({
      status: "PUBLISHED",
      seller: { identityVerification: { is: { status: "APPROVED" } } },
    });
    expect(m.listingFindMany.mock.calls[0][0].skip).toBe(0);
  });
});

describe("getPublicListingsByIds", () => {
  it("sólo publicadas de vendedores verificados, en el orden pedido", async () => {
    m.listingFindMany.mockResolvedValue([listingConVendedor({ name: "Ana" }, { id: 5 }), listingConVendedor({ name: "Bea" }, { id: 9 })]);
    const r = await getPublicListingsByIds([9, 4, 5]);
    expect(r.map((l) => l.id)).toEqual([9, 5]);
    expect(m.listingFindMany.mock.calls[0][0].where).toMatchObject({
      id: { in: [9, 4, 5] },
      status: "PUBLISHED",
      seller: { identityVerification: { is: { status: "APPROVED" } } },
    });
    expect(r[0].photoUrls).toHaveLength(1);
  });

  it("sin ids no consulta", async () => {
    expect(await getPublicListingsByIds([])).toEqual([]);
    expect(m.listingFindMany).not.toHaveBeenCalled();
  });
});

describe("recordView", () => {
  it("suma una vista por persona y publicación", async () => {
    m.listingFindFirst.mockResolvedValue({ sellerId: 33 });
    await recordView(5, 40);
    const args = m.viewUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ listingId_userId: { listingId: 5, userId: 40 } });
    expect(args.update.count).toEqual({ increment: 1 });
    expect(args.create).toMatchObject({ listingId: 5, userId: 40 });
  });

  it("no registra al propio vendedor", async () => {
    m.listingFindFirst.mockResolvedValue({ sellerId: 40 });
    await recordView(5, 40);
    expect(m.viewUpsert).not.toHaveBeenCalled();
  });

  it("nunca tira error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.listingFindFirst.mockResolvedValue({ sellerId: 33 });
    m.viewUpsert.mockRejectedValue(new Error("base caída"));
    await expect(recordView(5, 40)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("precios", () => {
  it("pesos y dólares con separador de miles", () => {
    expect(formatPesos(1850000)).toBe("$ 1.850.000");
    expect(formatDolares(1500)).toBe("US$ 1.500");
  });
});
