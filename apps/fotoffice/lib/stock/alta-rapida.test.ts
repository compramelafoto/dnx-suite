import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;

const coincide = (f: Fila, w: Where | undefined) => !w || Object.entries(w).every(([k, v]) => f[k] === v);

let n = 0;
function crearBase() {
  const t = {
    recepciones: [{ id: "r1", workspaceId: "ws1", estado: "BORRADOR" }] as Fila[],
    lineas: [] as Fila[],
    productos: [] as Fila[],
    insumos: [] as Fila[],
  };
  const registro: string[] = [];
  const tabla = (filas: Fila[], nombre: string, rel: (f: Fila) => Fila = (f) => f) => ({
    findFirst: vi.fn(async (a: { where?: Where } = {}) => {
      const r = filas.find((f) => coincide(f, a.where));
      return r ? rel(r) : null;
    }),
    findMany: vi.fn(async (a: { where?: Where } = {}) => filas.filter((f) => coincide(f, a.where)).map(rel)),
    create: vi.fn(async (a: { data: Fila }) => {
      registro.push(`${nombre}.create`);
      const fila = { id: `${nombre}${++n}`, ...a.data };
      filas.push(fila);
      return fila;
    }),
    update: vi.fn(async (a: { where: Where; data: Fila }) => {
      const f = filas.find((x) => coincide(x, a.where))!;
      for (const [k, v] of Object.entries(a.data)) {
        f[k] = v !== null && typeof v === "object" && "increment" in v ? (f[k] as number) + (v as { increment: number }).increment : v;
      }
      return f;
    }),
  });
  const db = {
    t,
    registro,
    $queryRaw: vi.fn(async (_q: unknown, ...vals: unknown[]) =>
      t.recepciones.filter((r) => r.id === vals[0] && r.workspaceId === vals[1]),
    ),
    fotofficeRecepcionLinea: tabla(t.lineas, "linea"),
    product: tabla(t.productos, "product", (p) => ({
      ...p,
      fotofficeInsumo: t.insumos.find((i) => i.productId === p.id) ?? null,
    })),
    productVariant: { findFirst: vi.fn(async () => null) },
    fotofficeInsumo: {
      upsert: vi.fn(async (a: { create: Fila }) => {
        registro.push("insumo.upsert");
        t.insumos.push(a.create);
      }),
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return db;
}

let db = crearBase();
vi.mock("@repo/db", () => ({
  get prisma() {
    return db;
  },
}));
const upsertGlobal = vi.fn(async () => ({ id: "g1", created: true }));
vi.mock("@/lib/sales/global-catalog", () => ({ upsertGlobalProduct: upsertGlobal }));

const { validarAltaRapida, crearDesdeRecepcion } = await import("./alta-rapida");
type Alta = Parameters<typeof validarAltaRapida>[0];

const prod = (o: Partial<Alta> = {}): Alta => ({
  codigo: "7790001112223",
  nombre: "Marco 10x15",
  kind: "PRODUCTO",
  precioMinor: 350000,
  unidad: null,
  unidadCompra: null,
  unidadesPorCompra: null,
  ...o,
});
const insumo = (o: Partial<Alta> = {}): Alta =>
  prod({ kind: "INSUMO", precioMinor: null, unidad: "copias", ...o });

beforeEach(() => {
  db = crearBase();
  n = 0;
  upsertGlobal.mockClear();
});

describe("validarAltaRapida", () => {
  it("pide nombre", () => {
    expect(validarAltaRapida(prod({ nombre: "  " })).ok).toBe(false);
  });
  it("el producto exige precio >= 0", () => {
    expect(validarAltaRapida(prod({ precioMinor: null }))).toEqual({ ok: false, error: "Poné el precio de venta." });
    expect(validarAltaRapida(prod({ precioMinor: -1 }))).toEqual({ ok: false, error: "Poné el precio de venta." });
    expect(validarAltaRapida(prod({ precioMinor: 0 })).ok).toBe(true);
  });
  it("el insumo exige unidad, con el mensaje del formulario", () => {
    expect(validarAltaRapida(insumo({ unidad: "" }))).toEqual({
      ok: false,
      error: "Decí en qué se cuenta: copias, sobres, ml…",
    });
    expect(validarAltaRapida(insumo()).ok).toBe(true);
  });
  it("unidad de compra sin unidades por compra es error", () => {
    expect(validarAltaRapida(insumo({ unidadCompra: "kit" })).ok).toBe(false);
    expect(validarAltaRapida(insumo({ unidadCompra: "kit", unidadesPorCompra: 500 })).ok).toBe(true);
  });
});

describe("crearDesdeRecepcion", () => {
  it("crea el producto con ficha global y agrega la línea LECTOR", async () => {
    const r = await crearDesdeRecepcion("ws1", 7, "r1", prod());
    expect(r.ok).toBe(true);
    expect(db.t.productos[0]).toMatchObject({
      kind: "PRODUCTO", name: "Marco 10x15", priceArs: "3500.00", tracksStock: true,
      barcode: "7790001112223", globalProductId: "g1", workspaceId: "ws1", isActive: true, createdByUserId: 7,
    });
    expect(db.t.lineas[0]).toMatchObject({ cantidad: 1, origen: "LECTOR", codigoBarras: "7790001112223", enUnidadDeCompra: false });
  });

  it("sin código: línea MANUAL y sin ficha global", async () => {
    await crearDesdeRecepcion("ws1", null, "r1", prod({ codigo: null }));
    expect(upsertGlobal).not.toHaveBeenCalled();
    expect(db.t.productos[0]).toMatchObject({ barcode: null, globalProductId: null });
    expect(db.t.lineas[0]).toMatchObject({ origen: "MANUAL" });
  });

  it("insumo: precio 0, ficha y línea en unidad de compra", async () => {
    const r = await crearDesdeRecepcion("ws1", 1, "r1", insumo({ unidadCompra: "kit", unidadesPorCompra: 500 }));
    expect(r.ok).toBe(true);
    expect(db.t.productos[0]).toMatchObject({ kind: "INSUMO", priceArs: "0.00" });
    expect(db.t.insumos[0]).toMatchObject({ unidad: "copias", unidadCompra: "kit", unidadesPorCompra: 500 });
    expect(db.t.lineas[0]).toMatchObject({ enUnidadDeCompra: true, unidadesPorCompra: 500, cantidad: 1 });
  });

  it("si ya hay un producto del negocio con ese código lo reutiliza y suma la línea", async () => {
    db.t.productos.push({ id: "pX", workspaceId: "ws1", name: "Marco", kind: "PRODUCTO", barcode: "7790001112223", isActive: true });
    const a = await crearDesdeRecepcion("ws1", 1, "r1", prod({ codigo: "779 0001-112223" }));
    const b = await crearDesdeRecepcion("ws1", 1, "r1", prod());
    expect(a).toEqual({ ok: true, productId: "pX", reutilizado: true });
    expect(b).toEqual({ ok: true, productId: "pX", reutilizado: true });
    expect(db.t.productos).toHaveLength(1);
    expect(db.registro).not.toContain("product.create");
    expect(upsertGlobal).not.toHaveBeenCalled();
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0]).toMatchObject({ productId: "pX", cantidad: 2 });
  });

  it("código interno (no numérico) de un producto activo: lo reutiliza", async () => {
    db.t.productos.push({ id: "pS", workspaceId: "ws1", kind: "PRODUCTO", sku: "PR-13", isActive: true });
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod({ codigo: "PR-13" }));
    expect(r).toEqual({ ok: true, productId: "pS", reutilizado: true });
    expect(db.t.productos).toHaveLength(1);
    expect(db.t.lineas[0]).toMatchObject({ productId: "pS", cantidad: 1, origen: "LECTOR" });
  });

  it("código interno de un producto dado de baja: error, sin crear", async () => {
    db.t.productos.push({ id: "pS", workspaceId: "ws1", sku: "PR-13", isActive: false });
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod({ codigo: "PR-13" }));
    expect(r).toEqual({ ok: false, error: "Ese código ya es de un producto dado de baja: reactivalo desde el catálogo." });
    expect(db.t.productos).toHaveLength(1);
    expect(db.t.lineas).toHaveLength(0);
  });

  it("barcode de un producto dado de baja: error, sin duplicar", async () => {
    db.t.productos.push({ id: "pB", workspaceId: "ws1", barcode: "7790001112223", isActive: false });
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod());
    expect(r.ok).toBe(false);
    expect(db.t.productos).toHaveLength(1);
    expect(db.t.lineas).toHaveLength(0);
  });

  it("insumo existente con ese código: lo reutiliza y suma por bulto", async () => {
    db.t.productos.push({ id: "pI", workspaceId: "ws1", name: "Kit", kind: "INSUMO", barcode: "7790001112223", isActive: true });
    db.t.insumos.push({ productId: "pI", unidad: "copias", unidadCompra: "kit", unidadesPorCompra: 500 });
    await crearDesdeRecepcion("ws1", 1, "r1", insumo());
    const r = await crearDesdeRecepcion("ws1", 1, "r1", insumo());
    expect(r).toEqual({ ok: true, productId: "pI", reutilizado: true });
    expect(db.t.productos).toHaveLength(1);
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0]).toMatchObject({ cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 500 });
  });

  it("un producto de otro negocio con ese código no cuenta", async () => {
    db.t.productos.push({ id: "pY", workspaceId: "otro", barcode: "7790001112223", isActive: true });
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod());
    expect(r.ok && r.productId).not.toBe("pY");
    expect(db.t.productos).toHaveLength(2);
  });

  it("una recepción confirmada no se toca", async () => {
    db.t.recepciones[0].estado = "CONFIRMADA";
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod());
    expect(r.ok).toBe(false);
    expect(db.t.productos).toHaveLength(0);
  });

  it("datos inválidos no abren transacción", async () => {
    const r = await crearDesdeRecepcion("ws1", 1, "r1", prod({ precioMinor: null }));
    expect(r.ok).toBe(false);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
