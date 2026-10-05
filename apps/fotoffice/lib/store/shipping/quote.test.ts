import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiCorreoError } from "@/lib/integrations/correo-argentino/errors";
import type { MiCorreoRate, MiCorreoRatesInput } from "@/lib/integrations/correo-argentino/client";

vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/integrations/correo-argentino/credentials", () => ({
  loadCorreoArgentinoClient: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
  markCorreoNeedsReconsent: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
}));

vi.mock("@/lib/integrations/andreani/credentials", () => ({
  loadAndreaniClient: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
  markAndreaniNeedsReconsent: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
}));

const { quoteShipping } = await import("./quote");
const { AndreaniError } = await import("@/lib/integrations/andreani/errors");

const dec = (s: string) => ({ toString: () => s });

type Settings = Record<string, unknown>;

function baseSettings(over: Settings = {}): Settings {
  return {
    homeDeliveryEnabled: true,
    branchDeliveryEnabled: false,
    source: "TABLE",
    tableAsFallback: true,
    originPostalCode: "2000",
    surchargeKind: "NONE",
    surchargeValue: 0,
    packagingGrams: 100,
    defaultUnitGrams: 500,
    boxLengthCm: 30,
    boxWidthCm: 20,
    boxHeightCm: 10,
    ...over,
  };
}

const ZONAS = [
  {
    id: "z-rosario",
    name: "Rosario",
    postalCodes: ["2000"],
    provinceCodes: [],
    isRestOfCountry: false,
    sortOrder: 0,
    rates: [
      { maxGrams: 1000, priceArs: dec("1500.00") },
      { maxGrams: 5000, priceArs: dec("3000.00") },
    ],
  },
  {
    id: "z-resto",
    name: "Resto del país",
    postalCodes: [],
    provinceCodes: [],
    isRestOfCountry: true,
    sortOrder: 1,
    rates: [{ maxGrams: 2000, priceArs: dec("5000.00") }],
  },
];

type Listing = {
  productId: string;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** Lo que trae la base para el valor declarado (Andreani); los tests de siempre no lo cargan. */
  product?: { priceArs: unknown; variants: { id: string; priceArs: unknown }[] };
};

type Format = {
  id: string;
  workspaceId: string;
  isActive: boolean;
  weightGrams: number | null;
  packLengthCm: number | null;
  packWidthCm: number | null;
  packHeightCm: number | null;
  priceArs?: unknown;
};

function fakeDb(opts: { settings?: Settings | null; zones?: unknown[]; listings?: Listing[]; formats?: Format[] } = {}) {
  const settings = opts.settings === undefined ? baseSettings() : opts.settings;
  const listings = opts.listings ?? [
    { productId: "p1", weightGrams: 300, lengthCm: null, widthCm: null, heightCm: null },
  ];
  return {
    storeShippingSettings: { findUnique: vi.fn(async () => settings) },
    storeShippingZone: { findMany: vi.fn(async () => opts.zones ?? ZONAS) },
    productStoreListing: {
      findMany: vi.fn(async (args: { where: { productId: { in: string[] } } }) =>
        listings.filter((l) => args.where.productId.in.includes(l.productId)),
      ),
    },
    printFormat: {
      findMany: vi.fn(async (args: { where: { workspaceId: string; isActive: boolean; id: { in: string[] } } }) =>
        (opts.formats ?? []).filter(
          (f) => f.workspaceId === args.where.workspaceId && f.isActive === args.where.isActive && args.where.id.in.includes(f.id),
        ),
      ),
    },
  };
}

function correoDeps(rates: MiCorreoRate[] | Error) {
  const ratesFn = vi.fn(async (_input: MiCorreoRatesInput) => {
    if (rates instanceof Error) throw rates;
    return rates;
  });
  const loadCorreo = vi.fn(async () => ({
    client: { rates: ratesFn, getToken: vi.fn(), validateUser: vi.fn(), agencies: vi.fn() },
    customerId: "0090000025",
  }));
  const markNeedsReconsent = vi.fn(async () => undefined);
  return { ratesFn, loadCorreo, markNeedsReconsent, deps: { loadCorreo, markNeedsReconsent } };
}

const ROSARIO = { postalCode: "2000", provinceCode: "S" };
const ITEMS = [{ productId: "p1", variantId: null, qty: 2 }];

describe("quoteShipping — tabla", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cotiza por la zona más específica y el escalón de peso", async () => {
    const db = fakeDb();
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({
      ok: true,
      quote: expect.objectContaining({
        method: "HOME",
        source: "TABLE",
        baseMinor: 150000,
        surchargeMinor: 0,
        totalMinor: 150000,
        serviceName: "Envío a Rosario",
        package: { weightGrams: 700, lengthCm: 30, widthCm: 20, heightCm: 10 },
      }),
    });
    // Todas las lecturas filtran por institución.
    expect(db.storeShippingSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws1" } }),
    );
    expect(db.storeShippingZone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws1" } }),
    );
    expect(db.productStoreListing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "ws1",
          sellOnline: true,
          product: { workspaceId: "ws1", isActive: true },
        }),
      }),
    );
  });

  it("aplica el recargo sobre el precio base", async () => {
    const db = fakeDb({ settings: baseSettings({ surchargeKind: "PERCENT", surchargeValue: 1000 }) });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r.ok && r.quote).toMatchObject({ baseMinor: 150000, surchargeMinor: 15000, totalMinor: 165000 });
  });

  it("usa el peso por defecto si el producto no lo tiene y descarta cantidades en cero", async () => {
    const db = fakeDb({
      listings: [
        { productId: "p1", weightGrams: null, lengthCm: null, widthCm: null, heightCm: null },
        { productId: "p2", weightGrams: 9000, lengthCm: null, widthCm: null, heightCm: null },
      ],
    });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [
        { productId: "p1", variantId: "v1", qty: 3 },
        { productId: "p2", variantId: null, qty: 0 },
      ],
      db: db as never,
    });
    // 3 × 500 + 100 de embalaje = 1600 → segundo escalón.
    expect(r.ok && r.quote).toMatchObject({ baseMinor: 300000, package: { weightGrams: 1600 } });
  });

  it("sin zona que cubra el destino → NO_COVERAGE", async () => {
    const db = fakeDb({ zones: [ZONAS[0]] });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: { postalCode: "5000", provinceCode: "X" },
      items: ITEMS,
      db: db as never,
    });
    expect(r).toEqual({ ok: false, reason: "NO_COVERAGE" });
  });

  it("peso por encima del último escalón → NO_COVERAGE", async () => {
    const db = fakeDb({
      listings: [{ productId: "p1", weightGrams: 3000, lengthCm: null, widthCm: null, heightCm: null }],
    });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "NO_COVERAGE" });
  });

  it.each([
    [{ postalCode: "abc", provinceCode: "S" }],
    [{ postalCode: "2000", provinceCode: "I" }],
    [{ postalCode: "0999", provinceCode: "S" }],
  ])("destino inválido %j → NO_COVERAGE", async (destination) => {
    const db = fakeDb();
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "NO_COVERAGE" });
  });

  it("acepta el CP en formato CPA", async () => {
    const db = fakeDb();
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: { postalCode: " s2000abc ", provinceCode: "S" },
      items: ITEMS,
      db: db as never,
    });
    expect(r.ok && r.quote.serviceName).toBe("Envío a Rosario");
  });
});

describe("quoteShipping — método apagado o datos faltantes", () => {
  it("sin configuración → DISABLED", async () => {
    const db = fakeDb({ settings: null });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "DISABLED" });
  });

  it("domicilio apagado → DISABLED", async () => {
    const db = fakeDb({ settings: baseSettings({ homeDeliveryEnabled: false }) });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "DISABLED" });
  });

  it("sucursal con la tabla como fuente → DISABLED aunque esté prendida", async () => {
    const db = fakeDb({ settings: baseSettings({ branchDeliveryEnabled: true, source: "TABLE" }) });
    const r = await quoteShipping({ workspaceId: "ws1", method: "BRANCH", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "DISABLED" });
  });

  it("sucursal apagada → DISABLED", async () => {
    const db = fakeDb({ settings: baseSettings({ source: "CORREO_ARGENTINO", branchDeliveryEnabled: false }) });
    const r = await quoteShipping({ workspaceId: "ws1", method: "BRANCH", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(r).toEqual({ ok: false, reason: "DISABLED" });
  });

  it("un producto que no es de la institución o no se vende online → UNAVAILABLE", async () => {
    const db = fakeDb();
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [...ITEMS, { productId: "ajeno", variantId: null, qty: 1 }],
      db: db as never,
    });
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });

  it("carrito vacío (o todo en cero) → UNAVAILABLE", async () => {
    const db = fakeDb();
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [{ productId: "p1", variantId: null, qty: 0 }],
      db: db as never,
    });
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });
});

describe("quoteShipping — Correo Argentino", () => {
  const correoSettings = (over: Settings = {}) =>
    baseSettings({ source: "CORREO_ARGENTINO", branchDeliveryEnabled: true, ...over });

  const RATES: MiCorreoRate[] = [
    { deliveredType: "D", productName: "Correo Argentino Clasico", priceMinor: 498006, raw: { a: 1 } },
    { deliveredType: "D", productName: "Correo Argentino Expreso", priceMinor: 300000, raw: { a: 2 } },
    { deliveredType: "S", productName: "Correo Argentino Clasico", priceMinor: 250000, raw: { a: 3 } },
  ];

  it("domicilio: pide D y elige la tarifa más barata de ese tipo, con recargo fijo", async () => {
    const db = fakeDb({ settings: correoSettings({ surchargeKind: "FIXED", surchargeValue: 5000 }) });
    const c = correoDeps(RATES);
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(c.loadCorreo).toHaveBeenCalledWith("ws1");
    expect(c.ratesFn).toHaveBeenCalledWith({
      customerId: "0090000025",
      postalCodeOrigin: "2000",
      postalCodeDestination: "2000",
      deliveredType: "D",
      dimensions: { weight: 700, length: 30, width: 20, height: 10 },
    });
    expect(r).toEqual({
      ok: true,
      quote: {
        method: "HOME",
        source: "CORREO_ARGENTINO",
        baseMinor: 300000,
        surchargeMinor: 5000,
        totalMinor: 305000,
        serviceName: "Correo Argentino Expreso",
        package: { weightGrams: 700, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { a: 2 },
      },
    });
  });

  it("sucursal: pide S", async () => {
    const db = fakeDb({ settings: correoSettings() });
    const c = correoDeps(RATES);
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "BRANCH",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(c.ratesFn.mock.calls[0][0].deliveredType).toBe("S");
    expect(r.ok && r.quote).toMatchObject({ method: "BRANCH", source: "CORREO_ARGENTINO", baseMinor: 250000 });
  });

  it("credenciales vencidas (AUTH): marca reconexión y cae a la tabla", async () => {
    const db = fakeDb({ settings: correoSettings() });
    const c = correoDeps(new MiCorreoError("AUTH", "x", 401));
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(c.markNeedsReconsent).toHaveBeenCalledWith("ws1");
    expect(r.ok && r.quote).toMatchObject({ source: "TABLE", baseMinor: 150000 });
  });

  it("correo caído sin respaldo → UNAVAILABLE, sin marcar reconexión", async () => {
    const db = fakeDb({ settings: correoSettings({ tableAsFallback: false }) });
    const c = correoDeps(new MiCorreoError("NETWORK", "x"));
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(c.markNeedsReconsent).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });

  it("sucursal no tiene respaldo de tabla → UNAVAILABLE", async () => {
    const db = fakeDb({ settings: correoSettings() });
    const c = correoDeps(new MiCorreoError("UNEXPECTED", "x", 500));
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "BRANCH",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });

  it("un error que no es de MiCorreo tampoco hace lanzar", async () => {
    const db = fakeDb({ settings: correoSettings() });
    const c = correoDeps(new Error("boom"));
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(r.ok && r.quote.source).toBe("TABLE");
  });

  it("MiCorreo no conectado → respaldo a la tabla", async () => {
    const db = fakeDb({ settings: correoSettings() });
    const loadCorreo = vi.fn(async () => null);
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: { loadCorreo, markNeedsReconsent: vi.fn() },
    });
    expect(r.ok && r.quote.source).toBe("TABLE");
  });

  it("sin CP de origen → no llama a MiCorreo y usa el respaldo", async () => {
    const db = fakeDb({ settings: correoSettings({ originPostalCode: null }) });
    const c = correoDeps(RATES);
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(c.loadCorreo).not.toHaveBeenCalled();
    expect(r.ok && r.quote.source).toBe("TABLE");
  });

  it("MiCorreo no devuelve tarifas del tipo pedido → respaldo", async () => {
    const db = fakeDb({ settings: correoSettings({ tableAsFallback: false }) });
    const c = correoDeps([RATES[2]]);
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: c.deps,
    });
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });

  describe("paquete demasiado grande para Correo", () => {
    const pesado = [{ productId: "p1", weightGrams: 26000, lengthCm: null, widthCm: null, heightCm: null }];

    it("sin respaldo → TOO_BIG y no llama a MiCorreo", async () => {
      const db = fakeDb({ settings: correoSettings({ tableAsFallback: false }), listings: pesado });
      const c = correoDeps(RATES);
      const r = await quoteShipping({
        workspaceId: "ws1",
        method: "HOME",
        destination: ROSARIO,
        items: [{ productId: "p1", variantId: null, qty: 1 }],
        db: db as never,
        deps: c.deps,
      });
      expect(c.loadCorreo).not.toHaveBeenCalled();
      expect(r).toEqual({ ok: false, reason: "TOO_BIG" });
    });

    it("con respaldo → la tabla, si tiene un escalón que lo cubra", async () => {
      const zonas = [{ ...ZONAS[0], rates: [{ maxGrams: 30000, priceArs: dec("9000.50") }] }];
      const db = fakeDb({ settings: correoSettings(), listings: pesado, zones: zonas });
      const c = correoDeps(RATES);
      const r = await quoteShipping({
        workspaceId: "ws1",
        method: "HOME",
        destination: ROSARIO,
        items: [{ productId: "p1", variantId: null, qty: 1 }],
        db: db as never,
        deps: c.deps,
      });
      expect(c.loadCorreo).not.toHaveBeenCalled();
      expect(r.ok && r.quote).toMatchObject({ source: "TABLE", baseMinor: 900050 });
    });

    it("con respaldo pero la tabla tampoco lo cubre → NO_COVERAGE", async () => {
      const db = fakeDb({ settings: correoSettings(), listings: pesado });
      const r = await quoteShipping({
        workspaceId: "ws1",
        method: "HOME",
        destination: ROSARIO,
        items: [{ productId: "p1", variantId: null, qty: 1 }],
        db: db as never,
        deps: correoDeps(RATES).deps,
      });
      expect(r).toEqual({ ok: false, reason: "NO_COVERAGE" });
    });

    it("sucursal → TOO_BIG", async () => {
      const db = fakeDb({ settings: correoSettings(), listings: pesado });
      const r = await quoteShipping({
        workspaceId: "ws1",
        method: "BRANCH",
        destination: ROSARIO,
        items: [{ productId: "p1", variantId: null, qty: 1 }],
        db: db as never,
        deps: correoDeps(RATES).deps,
      });
      expect(r).toEqual({ ok: false, reason: "TOO_BIG" });
    });
  });
});

describe("quoteShipping — obras (peso y embalaje del formato)", () => {
  beforeEach(() => vi.clearAllMocks());

  const marco: Format = {
    id: "f1",
    workspaceId: "ws1",
    isActive: true,
    weightGrams: 800,
    packLengthCm: 50,
    packWidthCm: 40,
    packHeightCm: 6,
  };

  it("una obra usa el peso y las medidas de embalaje de su formato", async () => {
    const db = fakeDb({ formats: [marco] });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [{ kind: "artwork", printFormatId: "f1", qty: 2 }],
      db: db as never,
    });
    // 100 de embalaje + 2 × 800; largo y ancho del formato; alto 2 × 6.
    expect(r.ok && r.quote.package).toEqual({ weightGrams: 1700, lengthCm: 50, widthCm: 40, heightCm: 12 });
    expect(r.ok && r.quote.baseMinor).toBe(300000);
    expect(db.printFormat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws1", isActive: true, id: { in: ["f1"] } } }),
    );
    // Sin productos no se leen listados.
    expect(db.productStoreListing.findMany).not.toHaveBeenCalled();
  });

  it("formato sin peso → el peso por defecto; sin las tres medidas → la caja por defecto", async () => {
    const db = fakeDb({ formats: [{ ...marco, weightGrams: null, packHeightCm: null }] });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [{ kind: "artwork", printFormatId: "f1", qty: 1 }],
      db: db as never,
    });
    expect(r.ok && r.quote.package).toEqual({ weightGrams: 600, lengthCm: 30, widthCm: 20, heightCm: 10 });
  });

  it("carrito mixto: suma productos y obras", async () => {
    const db = fakeDb({ formats: [marco] });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [
        { productId: "p1", variantId: null, qty: 2 },
        { kind: "artwork", printFormatId: "f1", qty: 1 },
      ],
      db: db as never,
    });
    // 100 + 2 × 300 + 800.
    expect(r.ok && r.quote.package.weightGrams).toBe(1500);
    expect(r.ok && r.quote.package.heightCm).toBe(10);
  });

  it("formato inexistente, inactivo o de otra institución → UNAVAILABLE", async () => {
    for (const formats of [[], [{ ...marco, isActive: false }], [{ ...marco, workspaceId: "otro" }]]) {
      const db = fakeDb({ formats });
      const r = await quoteShipping({
        workspaceId: "ws1",
        method: "HOME",
        destination: ROSARIO,
        items: [{ kind: "artwork", printFormatId: "f1", qty: 1 }],
        db: db as never,
      });
      expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
    }
  });

  it("sólo productos: no lee formatos (sin cambios)", async () => {
    const db = fakeDb({ formats: [marco] });
    await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never });
    expect(db.printFormat.findMany).not.toHaveBeenCalled();
  });
});

describe("quoteShipping — Andreani", () => {
  beforeEach(() => vi.clearAllMocks());

  const andreaniSettings = (over: Settings = {}) =>
    baseSettings({ source: "ANDREANI", branchDeliveryEnabled: true, ...over });

  type Conexion = { contractBranch?: string | null; originBranch?: string | null };

  function andreaniDeps(result: { priceMinor: number; raw: unknown } | Error, conexion: Conexion = {}) {
    const quoteFn = vi.fn<(input: unknown) => Promise<{ priceMinor: number; raw: unknown }>>(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    const loadAndreani = vi.fn(async () => ({
      client: { cacheKey: "k", quote: quoteFn, getToken: vi.fn(), branches: vi.fn() },
      clientCode: "CL0001",
      contractHome: "400006709",
      contractBranch: conexion.contractBranch === undefined ? "400006711" : conexion.contractBranch,
      originBranch: conexion.originBranch ?? null,
    }));
    const markAndreaniNeedsReconsent = vi.fn(async () => undefined);
    return { quoteFn, loadAndreani, markAndreaniNeedsReconsent, deps: { loadAndreani, markAndreaniNeedsReconsent } };
  }

  // Precio del producto y de un talle, para el valor declarado.
  const conPrecios = (over: Partial<Listing> = {}) => [
    {
      productId: "p1",
      weightGrams: 300,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      product: { priceArs: dec("10000.00"), variants: [{ id: "v1", priceArs: dec("12000.50") }] },
      ...over,
    },
  ];

  it("domicilio: contrato de domicilio, un bulto en kilos, valor declarado y recargo", async () => {
    const db = fakeDb({ settings: andreaniSettings({ surchargeKind: "FIXED", surchargeValue: 5000 }), listings: conPrecios() });
    const a = andreaniDeps({ priceMinor: 704121, raw: { tarifaConIva: { total: "7041.21" } } }, { originBranch: "SFN" });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [
        { productId: "p1", variantId: null, qty: 2 },
        { productId: "p1", variantId: "v1", qty: 1 },
      ],
      db: db as never,
      deps: a.deps,
    });
    expect(a.loadAndreani).toHaveBeenCalledWith("ws1");
    // 100 de embalaje + 3 × 300 = 1000 g → 1 kg. Valor: 2 × 10000 + 12000,50.
    expect(a.quoteFn).toHaveBeenCalledWith({
      clientCode: "CL0001",
      contract: "400006709",
      postalCodeDestination: "2000",
      originBranch: "SFN",
      packages: [{ weightKg: 1, lengthCm: 30, widthCm: 20, heightCm: 10, declaredValueMinor: 3_200_050 }],
    });
    expect(r).toEqual({
      ok: true,
      quote: {
        method: "HOME",
        source: "ANDREANI",
        baseMinor: 704121,
        surchargeMinor: 5000,
        totalMinor: 709121,
        serviceName: "Andreani a domicilio",
        package: { weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { tarifaConIva: { total: "7041.21" } },
      },
    });
  });

  it("obras: el valor declarado es el precio del formato; sin precio legible, 0", async () => {
    const formato: Format = {
      id: "f1",
      workspaceId: "ws1",
      isActive: true,
      weightGrams: 800,
      packLengthCm: 50,
      packWidthCm: 40,
      packHeightCm: 6,
      priceArs: dec("25000.00"),
    };
    const db = fakeDb({ settings: andreaniSettings(), formats: [formato] });
    const a = andreaniDeps({ priceMinor: 900000, raw: {} });
    await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: [{ kind: "artwork", printFormatId: "f1", qty: 2 }],
      db: db as never,
      deps: a.deps,
    });
    expect(a.quoteFn.mock.calls[0][0]).toMatchObject({
      packages: [{ weightKg: 1.7, lengthCm: 50, widthCm: 40, heightCm: 12, declaredValueMinor: 5_000_000 }],
    });

    // Los listados de siempre no traen precio: el valor declarado es 0, la cotización sigue.
    const db2 = fakeDb({ settings: andreaniSettings() });
    const b = andreaniDeps({ priceMinor: 900000, raw: {} });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db2 as never, deps: b.deps });
    expect(b.quoteFn.mock.calls[0][0]).toMatchObject({ packages: [{ declaredValueMinor: 0 }] });
    expect(r.ok && r.quote.source).toBe("ANDREANI");
  });

  it("sucursal: contrato de sucursal y el CP de la sucursal, sin pedir la provincia", async () => {
    const db = fakeDb({ settings: andreaniSettings() });
    const a = andreaniDeps({ priceMinor: 500000, raw: { b: 1 } });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "BRANCH",
      destination: { postalCode: "5000", provinceCode: "" },
      items: ITEMS,
      db: db as never,
      deps: a.deps,
    });
    expect(a.quoteFn.mock.calls[0][0]).toMatchObject({ contract: "400006711", postalCodeDestination: "5000" });
    expect(r.ok && r.quote).toMatchObject({ method: "BRANCH", source: "ANDREANI", baseMinor: 500000, serviceName: "Andreani a sucursal" });
  });

  it("sucursal sin contrato de sucursal → DISABLED, sin cotizar", async () => {
    const db = fakeDb({ settings: andreaniSettings() });
    const a = andreaniDeps({ priceMinor: 500000, raw: {} }, { contractBranch: null });
    const r = await quoteShipping({ workspaceId: "ws1", method: "BRANCH", destination: ROSARIO, items: ITEMS, db: db as never, deps: a.deps });
    expect(r).toEqual({ ok: false, reason: "DISABLED" });
    expect(a.quoteFn).not.toHaveBeenCalled();
  });

  it("domicilio sigue exigiendo la provincia (la tabla de respaldo la usa)", async () => {
    const db = fakeDb({ settings: andreaniSettings() });
    const a = andreaniDeps({ priceMinor: 500000, raw: {} });
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: { postalCode: "2000", provinceCode: "" },
      items: ITEMS,
      db: db as never,
      deps: a.deps,
    });
    expect(r).toEqual({ ok: false, reason: "NO_COVERAGE" });
    expect(a.loadAndreani).not.toHaveBeenCalled();
  });

  it("credenciales vencidas (AUTH): marca reconexión de Andreani y cae a la tabla", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = fakeDb({ settings: andreaniSettings() });
    const a = andreaniDeps(new AndreaniError("AUTH", "Andreani rechazó las credenciales de usuario-x.", 401));
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never, deps: a.deps });
    expect(a.markAndreaniNeedsReconsent).toHaveBeenCalledWith("ws1");
    expect(r.ok && r.quote).toMatchObject({ source: "TABLE", baseMinor: 150000 });
    // El log lleva sólo kind y status.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("usuario-x");
    warn.mockRestore();
  });

  it("Andreani caído sin respaldo → UNAVAILABLE, sin marcar reconexión; sucursal nunca cae a la tabla", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = fakeDb({ settings: andreaniSettings({ tableAsFallback: false }) });
    const a = andreaniDeps(new AndreaniError("NETWORK", "x"));
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: ITEMS, db: db as never, deps: a.deps });
    expect(r).toEqual({ ok: false, reason: "UNAVAILABLE" });
    expect(a.markAndreaniNeedsReconsent).not.toHaveBeenCalled();

    const db2 = fakeDb({ settings: andreaniSettings() });
    const b = andreaniDeps(new Error("boom"));
    expect(
      await quoteShipping({ workspaceId: "ws1", method: "BRANCH", destination: ROSARIO, items: ITEMS, db: db2 as never, deps: b.deps }),
    ).toEqual({ ok: false, reason: "UNAVAILABLE" });
    warn.mockRestore();
  });

  it("Andreani no conectado → respaldo a la tabla; no usa MiCorreo", async () => {
    const db = fakeDb({ settings: andreaniSettings() });
    const loadCorreo = vi.fn();
    const r = await quoteShipping({
      workspaceId: "ws1",
      method: "HOME",
      destination: ROSARIO,
      items: ITEMS,
      db: db as never,
      deps: { loadAndreani: vi.fn(async () => null), loadCorreo },
    });
    expect(r.ok && r.quote.source).toBe("TABLE");
    expect(loadCorreo).not.toHaveBeenCalled();
  });

  it("paquete por encima de 50 kg: TOO_BIG sin respaldo; 26 kg sí se cotiza (el límite de Correo no aplica)", async () => {
    const pesado = (g: number) => [{ productId: "p1", weightGrams: g, lengthCm: null, widthCm: null, heightCm: null }];
    const db = fakeDb({ settings: andreaniSettings({ tableAsFallback: false }), listings: pesado(51000) });
    const a = andreaniDeps({ priceMinor: 100, raw: {} });
    const uno = [{ productId: "p1", variantId: null, qty: 1 }];
    expect(
      await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: uno, db: db as never, deps: a.deps }),
    ).toEqual({ ok: false, reason: "TOO_BIG" });
    expect(a.loadAndreani).not.toHaveBeenCalled();

    const db2 = fakeDb({ settings: andreaniSettings({ tableAsFallback: false }), listings: pesado(26000) });
    const r = await quoteShipping({ workspaceId: "ws1", method: "HOME", destination: ROSARIO, items: uno, db: db2 as never, deps: a.deps });
    expect(r.ok && r.quote.source).toBe("ANDREANI");
  });

  it("sucursal con la tabla como fuente sigue apagada", async () => {
    const db = fakeDb({ settings: baseSettings({ branchDeliveryEnabled: true, source: "TABLE" }) });
    const a = andreaniDeps({ priceMinor: 1, raw: {} });
    expect(
      await quoteShipping({ workspaceId: "ws1", method: "BRANCH", destination: ROSARIO, items: ITEMS, db: db as never, deps: a.deps }),
    ).toEqual({ ok: false, reason: "DISABLED" });
  });
});
