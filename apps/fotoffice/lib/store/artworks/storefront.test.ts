import { describe, expect, it, vi } from "vitest";

/**
 * Las obras en la tienda pública: reglas puras y la capa de consultas con una base en memoria.
 */
vi.mock("@repo/db", () => ({ prisma: {} }));

const {
  buildPublicArtworksPage,
  checkArtworkCartLines,
  contestKeys,
  decidePublicArtwork,
  getPublicArtwork,
  hasPublicArtworks,
  loadArtworkCartCatalog,
  loadPublicArtworks,
  PUBLIC_ARTWORKS_PAGE_SIZE,
  publicArtworkFormats,
} = await import("./storefront");
type Ctx = import("./storefront").PublicArtworkContext;
type Row = import("./storefront").ArtworkListingRow;
type Fmt = import("./storefront").PrintFormatRow;
type Detail = import("./storefront").PublicArtworkDetail;

const WS = "ws1";
const NOTIFICADO = new Date("2026-10-01T12:00:00Z");
const dec = (s: string) => ({ toString: () => s });

function fila(id: string, o: Partial<Row> = {}): Row {
  return {
    id,
    slug: `obra-${id}`,
    status: "PUBLISHED",
    entryId: `e-${id}`,
    title: `Obra ${id}`,
    authorDisplayName: "Ana Pérez",
    awardLabel: "1er premio",
    previewUrl: `https://r2/${id}.jpg`,
    previewWidth: 1600,
    previewHeight: 1067,
    // 6000 × 4000: 3:2, alcanza 30 × 45 a 150 dpi (2658 px) y no 100 × 150 (8858 px).
    originalWidth: 6000,
    originalHeight: 4000,
    contest: { id: "c1", slug: "salon-2026", title: "Salón 2026", organizationId: "org1" },
    ...o,
  };
}

function formato(id: string, o: Partial<Fmt> = {}): Fmt {
  return { id, name: `Copia ${id}`, kind: "PRINT", widthCm: 30, heightCm: 45, priceArs: dec("45000.00"), isActive: true, ...o };
}

function ctx(o: Partial<Ctx> = {}): Ctx {
  return {
    linkedOrganizationIds: new Set(["org1"]),
    formats: [formato("f1")],
    minDpi: 150,
    consents: new Map([
      ["e-a", { basis: "RULES", status: "NOTIFIED", notifiedAt: NOTIFICADO }],
      ["e-b", { basis: "EXPLICIT", status: "GRANTED", notifiedAt: NOTIFICADO }],
    ]),
    ...o,
  };
}

describe("publicArtworkFormats", () => {
  it("sólo activos y que la resolución alcanza; precio en centavos y aviso de bordes", () => {
    const r = publicArtworkFormats(
      { width: 6000, height: 4000 },
      [
        formato("f1"),
        formato("f2", { widthCm: 30, heightCm: 30, priceArs: dec("30000.50") }),
        formato("f3", { widthCm: 100, heightCm: 150 }),
        formato("f4", { isActive: false }),
      ],
      150,
    );
    expect(r).toEqual([
      { id: "f1", name: "Copia f1", kind: "PRINT", widthCm: 30, heightCm: 45, priceMinor: 4500000, needsBorders: false },
      { id: "f2", name: "Copia f2", kind: "PRINT", widthCm: 30, heightCm: 30, priceMinor: 3000050, needsBorders: true },
    ]);
  });
});

describe("decidePublicArtwork (reglas de visibilidad)", () => {
  it("publicada, vinculada, con permiso y formato: pública, sin ids de FotoRank en la ficha", () => {
    const r = decidePublicArtwork(fila("a"), ctx());
    expect(r?.artwork).toEqual({
      listingId: "a",
      slug: "obra-a",
      title: "Obra a",
      authorDisplayName: "Ana Pérez",
      awardLabel: "1er premio",
      contestTitle: "Salón 2026",
      imageUrl: "https://r2/a.jpg",
      previewWidth: 1600,
      previewHeight: 1067,
      fromPriceMinor: 4500000,
      formats: [expect.objectContaining({ id: "f1", priceMinor: 4500000 })],
    });
    const json = JSON.stringify(r?.artwork);
    expect(json).not.toContain("e-a");
    expect(json).not.toContain("c1");
    expect(json).not.toContain("org1");
  });

  it("EXPLICIT aceptado también", () => {
    expect(decidePublicArtwork(fila("b"), ctx())).not.toBeNull();
  });

  it.each<[string, Row, Partial<Ctx>]>([
    ["borrador", fila("a", { status: "DRAFT" }), {}],
    ["despublicada", fila("a", { status: "WITHDRAWN" }), {}],
    ["organización desvinculada", fila("a"), { linkedOrganizationIds: new Set(["otra"]) }],
    ["sin permiso", fila("x"), {}],
    ["permiso retirado", fila("a"), { consents: new Map([["e-a", { basis: "RULES", status: "WITHDRAWN", notifiedAt: NOTIFICADO }]]) }],
    ["aviso que nunca salió", fila("a"), { consents: new Map([["e-a", { basis: "RULES", status: "NOTIFIED", notifiedAt: null }]]) }],
    ["permiso pendiente", fila("a"), { consents: new Map([["e-a", { basis: "EXPLICIT", status: "PENDING", notifiedAt: NOTIFICADO }]]) }],
    ["sin formatos activos", fila("a"), { formats: [formato("f1", { isActive: false })] }],
    ["la resolución no alcanza", fila("a", { originalWidth: 1200, originalHeight: 800 }), {}],
  ])("%s: no es pública", (_caso, row, o) => {
    expect(decidePublicArtwork(row, ctx(o))).toBeNull();
  });

  it("autor y premio vacíos quedan null", () => {
    const r = decidePublicArtwork(fila("a", { authorDisplayName: "  ", awardLabel: "" }), ctx());
    expect(r?.artwork.authorDisplayName).toBeNull();
    expect(r?.artwork.awardLabel).toBeNull();
  });
});

describe("contestKeys", () => {
  it("la dirección del concurso; repetidas entre organizaciones, con sufijo estable", () => {
    const k = contestKeys([
      { id: "c2", slug: "salon" },
      { id: "c1", slug: "salon" },
      { id: "c3", slug: "otro" },
      { id: "c1", slug: "salon" },
    ]);
    expect(k).toEqual(
      new Map([
        ["c1", "salon"],
        ["c2", "salon-2"],
        ["c3", "otro"],
      ]),
    );
  });
});

describe("buildPublicArtworksPage", () => {
  const de = (id: string, c: { id: string; slug: string; title: string }) => ({
    artwork: decidePublicArtwork(fila(id), ctx({ consents: new Map([[`e-${id}`, { basis: "EXPLICIT", status: "GRANTED", notifiedAt: null }]]) }))!.artwork,
    contest: c,
  });
  const salon = { id: "c1", slug: "salon", title: "Salón" };
  const abierto = { id: "c2", slug: "abierto", title: "Abierto" };

  it("chips por concurso (alfabético, con cantidad) y filtro por clave", () => {
    const publicas = [de("a", salon), de("b", abierto), de("c", salon)];
    const todo = buildPublicArtworksPage(publicas, {});
    expect(todo.contests).toEqual([
      { key: "abierto", title: "Abierto", count: 1 },
      { key: "salon", title: "Salón", count: 2 },
    ]);
    expect(todo.contest).toBeNull();
    expect(todo.artworks.map((a) => a.listingId)).toEqual(["a", "b", "c"]);
    expect(todo.artworks[0]).not.toHaveProperty("formats");
    expect(todo.artworks[0].contestKey).toBe("salon");
    expect(todo.artworks[0].formatsCount).toBe(1);

    const filtrado = buildPublicArtworksPage(publicas, { contest: "salon" });
    expect(filtrado.contest?.key).toBe("salon");
    expect(filtrado.artworks.map((a) => a.listingId)).toEqual(["a", "c"]);
    expect(filtrado.contests).toHaveLength(2);

    expect(buildPublicArtworksPage(publicas, { contest: "no-existe" }).artworks).toHaveLength(3);
  });

  it("24 por página; la página se acota", () => {
    const publicas = Array.from({ length: 30 }, (_, i) => de(`o${i}`, salon));
    const p1 = buildPublicArtworksPage(publicas, { page: 1 });
    expect(PUBLIC_ARTWORKS_PAGE_SIZE).toBe(24);
    expect(p1.artworks).toHaveLength(24);
    expect(p1.totalPages).toBe(2);
    expect(buildPublicArtworksPage(publicas, { page: 2 }).artworks).toHaveLength(6);
    expect(buildPublicArtworksPage(publicas, { page: 99 }).page).toBe(2);
    expect(buildPublicArtworksPage(publicas, { page: Number.NaN }).page).toBe(1);
    expect(buildPublicArtworksPage([], {})).toMatchObject({ artworks: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("checkArtworkCartLines", () => {
  const detalle = (o: Partial<Detail> = {}): Detail => ({
    ...decidePublicArtwork(fila("a"), ctx({ formats: [formato("f1"), formato("f2", { widthCm: 20, heightCm: 30, priceArs: dec("20000.00") })] }))!.artwork,
    ...o,
  });
  const catalogo = (...ds: Detail[]) => new Map(ds.map((d) => [d.listingId, d]));
  const linea = (o: Record<string, unknown> = {}) => ({
    kind: "artwork" as const,
    artworkListingId: "a",
    printFormatId: "f1",
    qty: 1,
    ...o,
  });

  it("precio, título, formato e imagen del servidor", () => {
    const r = checkArtworkCartLines(catalogo(detalle()), [linea({ qty: 2, unitPriceMinor: 4500000, name: "Otro nombre" })]);
    expect(r.problems).toEqual([]);
    expect(r.lines).toEqual([
      {
        kind: "artwork",
        key: "a:a:f1",
        artworkListingId: "a",
        printFormatId: "f1",
        slug: "obra-a",
        title: "Obra a",
        formatName: "Copia f1 (30 × 45 cm)",
        imageUrl: "https://r2/a.jpg",
        unitPriceMinor: 4500000,
        qty: 2,
        available: null,
        maxQty: 20,
      },
    ]);
  });

  it("el precio del navegador no manda: sale el del formato, con aviso", () => {
    const r = checkArtworkCartLines(catalogo(detalle()), [linea({ unitPriceMinor: 1 })]);
    expect(r.lines[0].unitPriceMinor).toBe(4500000);
    expect(r.problems).toEqual([{ key: "a:a:f1", message: "El precio de Obra a (Copia f1) cambió: ahora es $ 45.000,00." }]);
  });

  it("obra que ya no es pública (despublicada, desvinculada, sin permiso): se quita", () => {
    const r = checkArtworkCartLines(catalogo(), [linea({ name: "Atardecer" })]);
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual([{ key: "a:a:f1", message: "Atardecer ya no está a la venta." }]);
  });

  it("formato inactivo o que la obra no alcanza: se quita", () => {
    const r = checkArtworkCartLines(catalogo(detalle()), [linea({ printFormatId: "f9" })]);
    expect(r.lines).toEqual([]);
    expect(r.problems[0].message).toBe("El formato elegido de Obra a ya no está disponible. Elegí otro.");
  });

  it("une repetidas y acota a 20 copias por formato", () => {
    const r = checkArtworkCartLines(catalogo(detalle()), [linea({ qty: 15 }), linea({ qty: 10 }), linea({ printFormatId: "f2" })]);
    expect(r.lines.map((l) => [l.key, l.qty, l.unitPriceMinor])).toEqual([
      ["a:a:f1", 20, 4500000],
      ["a:a:f2", 1, 2000000],
    ]);
    expect(r.problems).toEqual([
      { key: "a:a:f1", message: "Se pueden comprar hasta 20 copias de Obra a (Copia f1): ajustamos la cantidad." },
    ]);
  });
});

// ── Consultas, con una base en memoria ──────────────────────────────────────

type ListingDb = Row & { workspaceId: string; sortOrder: number; publishedAt: Date | null };

function baseFalsa(opts: {
  links?: { workspaceId: string; organizationId: string }[];
  listings?: ListingDb[];
  formats?: (Fmt & { workspaceId: string; sortOrder: number })[];
  minDpi?: number | null;
  consents?: { workspaceId: string; entryId: string; basis: string; status: string; notifiedAt: Date | null }[];
}) {
  const calls: Record<string, unknown[]> = { listing: [], consent: [], format: [], settings: [], link: [] };
  const db = {
    workspaceContestOrganizationLink: {
      findMany: async (a: { where: { workspaceId: string } }) => {
        calls.link.push(a);
        return (opts.links ?? []).filter((l) => l.workspaceId === a.where.workspaceId);
      },
    },
    artworkListing: {
      findMany: async (a: {
        where: { workspaceId: string; status: string; slug?: string; id?: { in: string[] }; contest: { organizationId: { in: string[] } } };
      }) => {
        calls.listing.push(a);
        const w = a.where;
        return (opts.listings ?? []).filter(
          (l) =>
            l.workspaceId === w.workspaceId &&
            l.status === w.status &&
            w.contest.organizationId.in.includes(l.contest.organizationId) &&
            (w.slug === undefined || l.slug === w.slug) &&
            (w.id === undefined || w.id.in.includes(l.id)),
        );
      },
    },
    printFormat: {
      findMany: async (a: { where: { workspaceId: string; isActive: boolean } }) => {
        calls.format.push(a);
        return (opts.formats ?? []).filter((f) => f.workspaceId === a.where.workspaceId && f.isActive === a.where.isActive);
      },
    },
    storePrintSettings: {
      findUnique: async (a: { where: { workspaceId: string } }) => {
        calls.settings.push(a);
        return opts.minDpi == null ? null : { minDpi: opts.minDpi };
      },
    },
    artworkConsent: {
      findMany: async (a: { where: { workspaceId: string; entryId: { in: string[] } } }) => {
        calls.consent.push(a);
        return (opts.consents ?? []).filter((c) => c.workspaceId === a.where.workspaceId && a.where.entryId.in.includes(c.entryId));
      },
    },
  };
  return { db: db as never, calls };
}

function listingDb(id: string, o: Partial<ListingDb> = {}): ListingDb {
  return { ...fila(id), workspaceId: WS, sortOrder: 0, publishedAt: NOTIFICADO, ...o };
}

const consentOk = (entryId: string, workspaceId = WS) => ({ workspaceId, entryId, basis: "RULES", status: "NOTIFIED", notifiedAt: NOTIFICADO });

function escenario() {
  return baseFalsa({
    links: [{ workspaceId: WS, organizationId: "org1" }, { workspaceId: "otro-ws", organizationId: "org2" }],
    listings: [
      listingDb("a"),
      listingDb("b", { contest: { id: "c2", slug: "abierto", title: "Abierto", organizationId: "org1" } }),
      // De otra organización, no vinculada a este workspace.
      listingDb("c", { contest: { id: "c3", slug: "ajeno", title: "Ajeno", organizationId: "org2" } }),
      // Despublicada.
      listingDb("d", { status: "WITHDRAWN" }),
      // Sin permiso vigente (retirado).
      listingDb("e"),
      // De otro workspace.
      listingDb("f", { workspaceId: "otro-ws" }),
    ],
    formats: [{ ...formato("f1"), workspaceId: WS, sortOrder: 0 }, { ...formato("fx"), workspaceId: "otro-ws", sortOrder: 0 }],
    minDpi: 150,
    consents: [
      consentOk("e-a"),
      consentOk("e-b"),
      consentOk("e-c"),
      consentOk("e-d"),
      { ...consentOk("e-e"), status: "WITHDRAWN" },
      consentOk("e-f", "otro-ws"),
    ],
  });
}

describe("loadPublicArtworks / getPublicArtwork / hasPublicArtworks / loadArtworkCartCatalog", () => {
  it("sólo las públicas del workspace; todas las consultas con workspaceId", async () => {
    const { db, calls } = escenario();
    const r = await loadPublicArtworks(WS, {}, db);
    expect(r.artworks.map((a) => a.listingId)).toEqual(["a", "b"]);
    expect(r.contests.map((c) => c.key)).toEqual(["abierto", "salon-2026"]);
    for (const lista of Object.values(calls)) {
      for (const c of lista) expect((c as { where: { workspaceId: string } }).where.workspaceId).toBe(WS);
    }
    // Ningún dato del autor ni de FotoRank llega a la vidriera.
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/authorUserId|entryId|"c1"|"c2"|org1/);
  });

  it("filtro por concurso", async () => {
    const { db } = escenario();
    const r = await loadPublicArtworks(WS, { contest: "abierto" }, db);
    expect(r.artworks.map((a) => a.listingId)).toEqual(["b"]);
  });

  it("sin organizaciones vinculadas no consulta obras", async () => {
    const { db, calls } = baseFalsa({ listings: [listingDb("a")], consents: [consentOk("e-a")] });
    expect(await hasPublicArtworks(WS, db)).toBe(false);
    expect(calls.listing).toHaveLength(0);
  });

  it("hasPublicArtworks", async () => {
    expect(await hasPublicArtworks(WS, escenario().db)).toBe(true);
    expect(await hasPublicArtworks("vacío", escenario().db)).toBe(false);
  });

  it("getPublicArtwork: la pública; la despublicada, ajena o sin permiso, null", async () => {
    const { db } = escenario();
    expect((await getPublicArtwork(WS, "obra-a", db))?.formats.map((f) => f.id)).toEqual(["f1"]);
    for (const slug of ["obra-c", "obra-d", "obra-e", "obra-f", "no-existe"]) {
      expect(await getPublicArtwork(WS, slug, db)).toBeNull();
    }
  });

  it("sin dpi configurado usa 150", async () => {
    const { db } = baseFalsa({
      links: [{ workspaceId: WS, organizationId: "org1" }],
      listings: [listingDb("a", { originalWidth: 2658, originalHeight: 1772 })],
      formats: [{ ...formato("f1"), workspaceId: WS, sortOrder: 0 }],
      minDpi: null,
      consents: [consentOk("e-a")],
    });
    expect(await getPublicArtwork(WS, "obra-a", db)).not.toBeNull();
  });

  it("loadArtworkCartCatalog: sólo las públicas pedidas; vacío sin consultar", async () => {
    const { db, calls } = escenario();
    const m = await loadArtworkCartCatalog(WS, ["a", "c", "d", "e", "a"], db);
    expect([...m.keys()]).toEqual(["a"]);
    expect((calls.listing[0] as { where: { id: { in: string[] } } }).where.id.in).toEqual(["a", "c", "d", "e"]);
    const vacio = baseFalsa({});
    expect((await loadArtworkCartCatalog(WS, [], vacio.db)).size).toBe(0);
    expect(vacio.calls.link).toHaveLength(0);
  });
});
