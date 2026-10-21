import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La recepción contra una base falsa en memoria (molde: `lib/sales/void-sale.test.ts`). Lo que
 * importa probar es lo que mueve stock: que confirmar escriba una ENTRADA por línea y nada más,
 * que dos confirmaciones no sumen dos veces y que una línea con un producto ajeno o dado de baja
 * no deje nada escrito. El `$transaction` falso no deshace: por eso los rechazos tienen que
 * ocurrir ANTES de la primera escritura, y las pruebas lo verifican mirando qué se escribió.
 */

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;

function coincide(fila: Fila, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Where[]).some((w) => coincide(fila, w));
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const op = v as { in?: unknown[]; not?: unknown };
      if ("in" in op) return (op.in as unknown[]).includes(fila[k]);
      if ("not" in op) return fila[k] !== op.not;
      return false;
    }
    return fila[k] === v;
  });
}

function ordenar(filas: Fila[], orderBy: unknown): Fila[] {
  const criterios = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<string, "asc" | "desc">[];
  return [...filas].sort((a, b) => {
    for (const c of criterios) {
      const [campo, dir] = Object.entries(c)[0];
      const x = a[campo] as number;
      const y = b[campo] as number;
      if (x !== y) return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function aplicar(fila: Fila, data: Fila): void {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === "object" && "increment" in (v as object)) {
      fila[k] = (fila[k] as number) + (v as { increment: number }).increment;
    } else if (v !== null && typeof v === "object" && "decrement" in (v as object)) {
      fila[k] = (fila[k] as number) - (v as { decrement: number }).decrement;
    } else {
      fila[k] = v;
    }
  }
}

let secuencia = 0;

function crearBase() {
  const t = {
    recepciones: [] as Fila[],
    lineas: [] as Fila[],
    productos: [] as Fila[],
    talles: [] as Fila[],
    insumos: [] as Fila[],
    proveedores: [] as Fila[],
    globales: [] as Fila[],
    movimientos: [] as Fila[],
  };
  const registro: string[] = [];

  function tabla(filas: () => Fila[], nombre: string, relaciones: (f: Fila) => Fila = (f) => f) {
    return {
      findFirst: vi.fn(async (a: { where?: Where; orderBy?: unknown } = {}) => {
        const r = ordenar(filas().filter((f) => coincide(f, a.where)), a.orderBy)[0];
        return r ? relaciones(r) : null;
      }),
      findUnique: vi.fn(async (a: { where: Where }) => {
        const r = filas().find((f) => coincide(f, a.where));
        return r ? relaciones(r) : null;
      }),
      findUniqueOrThrow: vi.fn(async (a: { where: Where }) => {
        const w = a.where.workspaceId_numero as Where | undefined;
        const r = filas().find((f) => coincide(f, w ?? a.where));
        if (!r) throw new Error("no encontrada");
        return relaciones(r);
      }),
      findMany: vi.fn(async (a: { where?: Where; orderBy?: unknown; take?: number } = {}) =>
        ordenar(filas().filter((f) => coincide(f, a.where)), a.orderBy)
          .slice(0, a.take ?? Infinity)
          .map(relaciones),
      ),
      create: vi.fn(async (a: { data: Fila }) => {
        registro.push(`${nombre}.create`);
        const fila = { id: `${nombre}${++secuencia}`, ...a.data };
        filas().push(fila);
        return fila;
      }),
      createMany: vi.fn(async (a: { data: Fila[]; skipDuplicates?: boolean }) => {
        registro.push(`${nombre}.createMany`);
        let count = 0;
        for (const d of a.data) {
          const choca = filas().some((f) => f.workspaceId === d.workspaceId && f.numero === d.numero);
          if (choca) continue;
          filas().push({ id: `${nombre}${++secuencia}`, estado: "BORRADOR", preciosConIva: true, ...d });
          count += 1;
        }
        return { count };
      }),
      update: vi.fn(async (a: { where: Where; data: Fila }) => {
        registro.push(`${nombre}.update`);
        const fila = filas().find((f) => coincide(f, a.where));
        if (!fila) throw new Error(`${nombre}: no existe`);
        aplicar(fila, a.data);
        return fila;
      }),
      updateMany: vi.fn(async (a: { where: Where; data: Fila }) => {
        registro.push(`${nombre}.updateMany`);
        const afectadas = filas().filter((f) => coincide(f, a.where));
        for (const f of afectadas) aplicar(f, a.data);
        return { count: afectadas.length };
      }),
      deleteMany: vi.fn(async (a: { where: Where }) => {
        registro.push(`${nombre}.deleteMany`);
        const antes = filas().length;
        const quedan = filas().filter((f) => !coincide(f, a.where));
        filas().splice(0, filas().length, ...quedan);
        return { count: antes - quedan.length };
      }),
    };
  }

  const conProducto = (l: Fila): Fila => {
    const p = t.productos.find((x) => x.id === l.productId);
    return {
      ...l,
      product: p ? { ...p, fotofficeInsumo: t.insumos.find((i) => i.productId === p.id) ?? null } : null,
    };
  };
  const conRelaciones = (r: Fila): Fila => ({
    ...r,
    proveedor: t.proveedores.find((p) => p.id === r.proveedorId) ?? null,
    lineas: ordenar(t.lineas.filter((l) => l.recepcionId === r.id), { order: "asc" }).map(conProducto),
  });

  const db = {
    t,
    registro,
    $queryRaw: vi.fn(async (q: unknown, ...valores: unknown[]) => {
      // Tagged template (`tx.$queryRaw\`...\``) o `Prisma.sql` (lo que manda `lockStockRows`).
      const texto = Array.isArray(q) ? q.join("?") : (q as { sql: string }).sql;
      const vals = Array.isArray(q) ? valores : (q as { values: unknown[] }).values;
      if (texto.includes(`"FotofficeRecepcion"`)) {
        registro.push("lock:recepcion");
        const [id, workspaceId] = vals;
        return t.recepciones
          .filter((r) => r.id === id && r.workspaceId === workspaceId)
          .map((r) => ({ id: r.id, estado: r.estado, numero: r.numero }));
      }
      if (texto.includes(`"Product"`)) {
        registro.push(`lock:stock:${(vals[0] as string[]).join(",")}`);
        return [];
      }
      registro.push("lock:otro");
      return [];
    }),
    fotofficeRecepcion: tabla(() => t.recepciones, "recepcion", conRelaciones),
    fotofficeRecepcionLinea: tabla(() => t.lineas, "linea", conProducto),
    product: tabla(() => t.productos, "product", (p) => ({
      ...p,
      fotofficeInsumo: t.insumos.find((i) => i.productId === p.id) ?? null,
    })),
    productVariant: tabla(() => t.talles, "variant"),
    fotofficeInsumo: tabla(() => t.insumos, "insumo"),
    fotofficeProveedor: tabla(() => t.proveedores, "proveedor"),
    globalProduct: tabla(() => t.globales, "global"),
    stockMovement: tabla(() => t.movimientos, "movimiento"),
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return db;
}

let db = crearBase();

vi.mock("@repo/db", () => ({
  get prisma() {
    return db;
  },
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings.join("?"), values }),
  },
}));

const {
  crearBorrador,
  buscarParaRecepcion,
  escanear,
  guardarLinea,
  quitarLinea,
  guardarEncabezado,
  descartar,
  confirmar,
  leerRecepcion,
  listarRecepciones,
} = await import("./recepcion-servidor");

const WS = "ws1";

function producto(over: Fila = {}): Fila {
  return {
    id: "p1",
    workspaceId: WS,
    name: "Portarretrato 13x18",
    kind: "PRODUCTO",
    sku: "PR-13",
    barcode: "7790001112223",
    isActive: true,
    priceArs: "5000.00",
    costArs: "2000.00",
    stockQty: 0,
    ...over,
  };
}

function recepcion(over: Fila = {}): Fila {
  return { id: "r1", workspaceId: WS, numero: 1, estado: "BORRADOR", fecha: new Date(), preciosConIva: true, ...over };
}

function linea(over: Fila = {}): Fila {
  return {
    id: "l1",
    recepcionId: "r1",
    workspaceId: WS,
    productId: "p1",
    descripcionOriginal: "Portarretrato 13x18",
    codigoBarras: null,
    cantidad: 1,
    enUnidadDeCompra: false,
    unidadesPorCompra: null,
    costoUnitarioArs: null,
    origen: "MANUAL",
    order: 0,
    ...over,
  };
}

const escrituras = () => db.registro.filter((r) => !r.startsWith("lock:"));

beforeEach(() => {
  db = crearBase();
  secuencia = 0;
});

describe("crearBorrador", () => {
  it("numera correlativo por negocio", async () => {
    db.t.recepciones.push(recepcion({ id: "r9", numero: 7 }), recepcion({ id: "rx", workspaceId: "otro", numero: 40 }));
    const r = await crearBorrador(WS, 3);
    expect(r.numero).toBe(8);
    const fila = db.t.recepciones.find((x) => x.id === r.id);
    expect(fila).toMatchObject({ workspaceId: WS, numero: 8, estado: "BORRADOR", createdByUserId: 3 });
  });

  it("si otro tomó el número un instante antes, reintenta con el siguiente", async () => {
    db.t.recepciones.push(recepcion({ id: "r9", numero: 7 }));
    // La primera lectura ve el 6 (vieja): el 7 choca, se relee y sale el 8.
    db.fotofficeRecepcion.findFirst.mockResolvedValueOnce({ numero: 6 } as never);
    const r = await crearBorrador(WS, null);
    expect(r.numero).toBe(8);
    expect(db.fotofficeRecepcion.createMany).toHaveBeenCalledTimes(2);
  });
});

describe("buscarParaRecepcion", () => {
  it("encuentra por código de barras (con espacios) o por código interno, incluidos los insumos", async () => {
    db.t.productos.push(producto(), producto({ id: "i1", kind: "INSUMO", sku: "KIT305", barcode: null }));
    expect(await buscarParaRecepcion(WS, "779 0001 112223")).toEqual({ tipo: "producto", productId: "p1" });
    expect(await buscarParaRecepcion(WS, "KIT305")).toEqual({ tipo: "producto", productId: "i1" });
  });

  it("no encuentra productos de otro negocio ni dados de baja", async () => {
    db.t.productos.push(producto({ workspaceId: "otro" }), producto({ id: "p2", isActive: false }));
    expect(await buscarParaRecepcion(WS, "7790001112223")).toEqual({ tipo: "nada" });
  });

  it("reconoce un talle", async () => {
    db.t.talles.push({ id: "v1", workspaceId: WS, productId: "p1", barcode: "7790009998887", sku: null });
    expect(await buscarParaRecepcion(WS, "7790009998887")).toEqual({ tipo: "talle" });
  });

  it("propone la ficha global, y si no hay nada dice nada", async () => {
    db.t.globales.push({ id: "g1", barcode: "7790005556667", name: "Álbum 20x30", brand: "Fotolibro", description: null, imageUrl: null });
    expect(await buscarParaRecepcion(WS, "7790005556667")).toEqual({ tipo: "global", nombre: "Álbum 20x30", marca: "Fotolibro" });
    expect(await buscarParaRecepcion(WS, "1234567890123")).toEqual({ tipo: "nada" });
    expect(await buscarParaRecepcion(WS, "   ")).toEqual({ tipo: "nada" });
  });
});

describe("escanear", () => {
  beforeEach(() => {
    db.t.recepciones.push(recepcion());
    db.t.productos.push(producto());
  });

  it("agrega una línea nueva con el nombre del producto", async () => {
    const r = await escanear(WS, "r1", "7790001112223");
    expect(r).toEqual({ ok: true, resultado: "agregado" });
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0]).toMatchObject({
      recepcionId: "r1",
      workspaceId: WS,
      productId: "p1",
      descripcionOriginal: "Portarretrato 13x18",
      codigoBarras: "7790001112223",
      cantidad: 1,
      enUnidadDeCompra: false,
      unidadesPorCompra: null,
      origen: "LECTOR",
    });
    // Lo primero es bloquear la recepción.
    expect(db.registro[0]).toBe("lock:recepcion");
  });

  it("suma uno a la línea que ya estaba", async () => {
    db.t.lineas.push(linea({ cantidad: 3 }));
    const r = await escanear(WS, "r1", "7790001112223");
    expect(r).toEqual({ ok: true, resultado: "sumado" });
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0].cantidad).toBe(4);
  });

  it("un insumo con ficha de compra entra en bultos, y el segundo escaneo suma al mismo bulto", async () => {
    db.t.productos.push(producto({ id: "i1", kind: "INSUMO", name: "Kit 305", barcode: "7790002223334" }));
    db.t.insumos.push({ id: "f1", workspaceId: WS, productId: "i1", unidad: "copias", unidadCompra: "Kit", unidadesPorCompra: 610 });
    expect(await escanear(WS, "r1", "7790002223334")).toEqual({ ok: true, resultado: "agregado" });
    expect(db.t.lineas[0]).toMatchObject({ productId: "i1", enUnidadDeCompra: true, unidadesPorCompra: 610 });
    expect(await escanear(WS, "r1", "7790002223334")).toEqual({ ok: true, resultado: "sumado" });
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0].cantidad).toBe(2);
  });

  it("un código de talle avisa y no escribe nada", async () => {
    db.t.talles.push({ id: "v1", workspaceId: WS, productId: "p1", barcode: "7790009998887", sku: null });
    const r = await escanear(WS, "r1", "7790009998887");
    expect(r).toEqual({ ok: false, error: "Ese código es de un talle: cargalo desde Stock." });
    expect(escrituras()).toEqual([]);
  });

  it("un código del catálogo global devuelve el alta precargada", async () => {
    db.t.globales.push({ id: "g1", barcode: "7790005556667", name: "Álbum 20x30", brand: "Fotolibro", description: null, imageUrl: null });
    const r = await escanear(WS, "r1", "779-0005556667");
    expect(r).toMatchObject({ ok: false, alta: { codigo: "7790005556667", nombre: "Álbum 20x30", marca: "Fotolibro" } });
    expect(escrituras()).toEqual([]);
  });

  it("un código desconocido devuelve el alta con el código solo", async () => {
    const r = await escanear(WS, "r1", "1234567890123");
    expect(r).toMatchObject({ ok: false, alta: { codigo: "1234567890123" } });
    expect(escrituras()).toEqual([]);
  });

  it("un producto con talles no se carga acá", async () => {
    db.t.talles.push({ id: "v1", workspaceId: WS, productId: "p1", barcode: "7790009998887", sku: null });
    const r = await escanear(WS, "r1", "7790001112223");
    expect(r).toEqual({ ok: false, error: "Ese producto tiene talles: cargalo desde Stock." });
    expect(escrituras()).toEqual([]);
  });

  it("sobre una recepción confirmada no escribe", async () => {
    db.t.recepciones[0].estado = "CONFIRMADA";
    const r = await escanear(WS, "r1", "7790001112223");
    expect(r).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(escrituras()).toEqual([]);
  });

  it("una recepción de otro negocio no existe", async () => {
    db.t.recepciones[0].workspaceId = "otro";
    const r = await escanear(WS, "r1", "7790001112223");
    expect(r).toEqual({ ok: false, error: "Esa recepción no existe." });
    expect(escrituras()).toEqual([]);
  });
});

describe("guardarLinea", () => {
  beforeEach(() => {
    db.t.recepciones.push(recepcion());
    db.t.productos.push(producto());
  });

  it("crea una línea a mano y edita una existente", async () => {
    expect(await guardarLinea(WS, "r1", { productId: "p1", cantidad: 2, costoUnitarioMinor: 150000 })).toEqual({ ok: true });
    expect(db.t.lineas[0]).toMatchObject({
      productId: "p1",
      descripcionOriginal: "Portarretrato 13x18",
      cantidad: 2,
      costoUnitarioArs: "1500.00",
      origen: "MANUAL",
      enUnidadDeCompra: false,
    });
    const id = db.t.lineas[0].id as string;
    expect(await guardarLinea(WS, "r1", { id, cantidad: 5, enUnidadDeCompra: true, unidadesPorCompra: 12 })).toEqual({ ok: true });
    expect(db.t.lineas[0]).toMatchObject({ cantidad: 5, enUnidadDeCompra: true, unidadesPorCompra: 12, costoUnitarioArs: "1500.00" });
  });

  it("rechaza un producto de otro negocio o dado de baja", async () => {
    db.t.productos.push(producto({ id: "ajeno", workspaceId: "otro" }), producto({ id: "baja", isActive: false }));
    for (const productId of ["ajeno", "baja", "inexistente"]) {
      expect(await guardarLinea(WS, "r1", { productId, cantidad: 1 })).toEqual({
        ok: false,
        error: "Ese producto no existe o está dado de baja.",
      });
    }
    expect(escrituras()).toEqual([]);
  });

  it("rechaza cantidades y costos que no son", async () => {
    expect((await guardarLinea(WS, "r1", { productId: "p1", cantidad: 0 })).ok).toBe(false);
    expect((await guardarLinea(WS, "r1", { productId: "p1", cantidad: 1.5 })).ok).toBe(false);
    expect((await guardarLinea(WS, "r1", { productId: "p1", costoUnitarioMinor: -1 })).ok).toBe(false);
    expect((await guardarLinea(WS, "r1", { productId: "p1", unidadesPorCompra: 0 })).ok).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  it("no toca una línea de otra recepción", async () => {
    db.t.lineas.push(linea({ id: "lx", recepcionId: "r2" }));
    expect(await guardarLinea(WS, "r1", { id: "lx", cantidad: 9 })).toEqual({ ok: false, error: "Esa línea no existe." });
    expect(db.t.lineas[0].cantidad).toBe(1);
  });

  it("sobre una recepción confirmada no escribe", async () => {
    db.t.recepciones[0].estado = "CONFIRMADA";
    db.t.lineas.push(linea());
    expect(await guardarLinea(WS, "r1", { id: "l1", cantidad: 9 })).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(escrituras()).toEqual([]);
  });
});

describe("quitarLinea, guardarEncabezado y descartar", () => {
  beforeEach(() => {
    db.t.recepciones.push(recepcion());
    db.t.lineas.push(linea());
    db.t.proveedores.push({ id: "prov1", workspaceId: WS, name: "Kodak" }, { id: "provX", workspaceId: "otro", name: "Ajeno" });
  });

  it("quita la línea de un borrador", async () => {
    expect(await quitarLinea(WS, "r1", "l1")).toEqual({ ok: true });
    expect(db.t.lineas).toHaveLength(0);
  });

  it("guarda el encabezado, con proveedor del negocio", async () => {
    const fecha = new Date("2026-10-20T15:00:00Z");
    const r = await guardarEncabezado(WS, "r1", { proveedorId: "prov1", fecha, comprobante: "  A-0001-123 ", preciosConIva: false, nota: " " });
    expect(r).toEqual({ ok: true });
    expect(db.t.recepciones[0]).toMatchObject({ proveedorId: "prov1", fecha, comprobante: "A-0001-123", preciosConIva: false, nota: null });
  });

  it("sin nota no toca la nota que ya tenía", async () => {
    db.t.recepciones[0].nota = "Faltó una caja";
    const fecha = new Date("2026-10-20T15:00:00Z");
    expect(await guardarEncabezado(WS, "r1", { proveedorId: null, fecha, comprobante: "B-1", preciosConIva: true })).toEqual({ ok: true });
    expect(db.t.recepciones[0]).toMatchObject({ comprobante: "B-1", nota: "Faltó una caja" });
  });

  it("rechaza un proveedor de otro negocio y una fecha inválida", async () => {
    const fecha = new Date();
    expect(await guardarEncabezado(WS, "r1", { proveedorId: "provX", fecha, comprobante: null, preciosConIva: true, nota: null })).toEqual({
      ok: false,
      error: "Ese proveedor no existe.",
    });
    expect(
      (await guardarEncabezado(WS, "r1", { proveedorId: null, fecha: new Date("nada"), comprobante: null, preciosConIva: true, nota: null })).ok,
    ).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  it("descarta un borrador", async () => {
    expect(await descartar(WS, "r1")).toEqual({ ok: true });
    expect(db.t.recepciones[0].estado).toBe("DESCARTADA");
  });

  it("sobre una confirmada: no quita, no cambia el encabezado, no descarta", async () => {
    db.t.recepciones[0].estado = "CONFIRMADA";
    expect(await quitarLinea(WS, "r1", "l1")).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(db.t.lineas).toHaveLength(1);
    expect(
      await guardarEncabezado(WS, "r1", { proveedorId: null, fecha: new Date(), comprobante: "x", preciosConIva: true, nota: null }),
    ).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(db.t.recepciones[0].comprobante).toBeUndefined();
    expect(await descartar(WS, "r1")).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(db.t.recepciones[0].estado).toBe("CONFIRMADA");
  });
});

describe("confirmar", () => {
  beforeEach(() => {
    db.t.recepciones.push(recepcion());
    db.t.productos.push(
      producto(),
      producto({ id: "i1", kind: "INSUMO", name: "Kit 305", barcode: null, sku: "KIT", costArs: "40.00" }),
    );
    db.t.lineas.push(
      linea({ id: "l1", productId: "p1", cantidad: 3, costoUnitarioArs: "2500.00", order: 0 }),
      // 2 cajas × 12 a $ 24.000 la caja ⇒ +24 unidades a $ 2.000 cada una.
      linea({ id: "l2", productId: "i1", cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 12, costoUnitarioArs: "24000.00", order: 1 }),
    );
  });

  it("escribe una ENTRADA por línea, en unidad de stock, y actualiza el costo", async () => {
    const r = await confirmar(WS, "r1", 7);
    expect(r).toEqual({ ok: true, movimientos: 2 });

    expect(db.t.movimientos).toEqual([
      expect.objectContaining({
        workspaceId: WS,
        productId: "p1",
        variantId: null,
        qty: 3,
        reason: "ENTRADA",
        sourceModule: "stock-recepcion",
        sourceRef: "r1",
        unitCostArs: "2500.00",
        createdByUserId: 7,
      }),
      expect.objectContaining({
        productId: "i1",
        qty: 24,
        reason: "ENTRADA",
        sourceModule: "stock-recepcion",
        sourceRef: "r1",
        unitCostArs: "2000.00",
      }),
    ]);
    const p1 = db.t.productos.find((p) => p.id === "p1");
    const i1 = db.t.productos.find((p) => p.id === "i1");
    expect(p1).toMatchObject({ stockQty: 3, costArs: "2500.00", costUpdatedAt: expect.any(Date) });
    expect(i1).toMatchObject({ stockQty: 24, costArs: "2000.00" });
    expect(db.t.recepciones[0]).toMatchObject({ estado: "CONFIRMADA", confirmedByUserId: 7, confirmedAt: expect.any(Date) });

    // La fila de la recepción se bloquea ANTES que el stock, y el stock con UNA sola llamada.
    const bloqueos = db.registro.filter((x) => x.startsWith("lock:"));
    expect(bloqueos).toEqual(["lock:recepcion", "lock:stock:i1,p1"]);
    expect(db.registro.indexOf("lock:stock:i1,p1")).toBeLessThan(db.registro.indexOf("movimiento.create"));
  });

  it("una línea sin costo no pisa el costo anterior", async () => {
    db.t.lineas[0].costoUnitarioArs = null;
    await confirmar(WS, "r1", null);
    expect(db.t.productos.find((p) => p.id === "p1")?.costArs).toBe("2000.00");
    expect(db.t.movimientos[0].unitCostArs).toBeNull();
  });

  it("la segunda confirmación no suma otra vez", async () => {
    expect((await confirmar(WS, "r1", 7)).ok).toBe(true);
    const movimientos = db.t.movimientos.length;
    const escriturasAntes = escrituras().length;

    const r = await confirmar(WS, "r1", 7);
    expect(r).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(db.t.movimientos).toHaveLength(movimientos);
    expect(escrituras()).toHaveLength(escriturasAntes);
    expect(db.t.productos.find((p) => p.id === "p1")?.stockQty).toBe(3);
  });

  it("una descartada tampoco se confirma", async () => {
    db.t.recepciones[0].estado = "DESCARTADA";
    expect(await confirmar(WS, "r1", 7)).toEqual({ ok: false, error: "Esa recepción está descartada." });
    expect(escrituras()).toEqual([]);
  });

  it.each([
    ["de otro negocio", { workspaceId: "otro" }],
    ["dado de baja", { isActive: false }],
  ])("un producto %s rechaza toda la confirmación sin escribir nada", async (_nombre, cambio) => {
    Object.assign(db.t.productos[1], cambio);
    const r = await confirmar(WS, "r1", 7);
    expect(r).toEqual({ ok: false, error: "Hay productos que ya no existen o están dados de baja: revisá las líneas." });
    expect(escrituras()).toEqual([]);
    expect(db.t.recepciones[0].estado).toBe("BORRADOR");
  });

  it("un producto con talles rechaza la confirmación", async () => {
    db.t.talles.push({ id: "v1", workspaceId: WS, productId: "p1", barcode: null, sku: null });
    const r = await confirmar(WS, "r1", 7);
    expect(r).toEqual({ ok: false, error: "Hay productos con talles: cargalos desde Stock." });
    expect(escrituras()).toEqual([]);
  });

  it("aplica las validaciones de las reglas (línea sin producto)", async () => {
    db.t.lineas[0].productId = null;
    expect(await confirmar(WS, "r1", 7)).toEqual({ ok: false, error: "Hay líneas sin producto: elegilo o quitalas." });
    expect(escrituras()).toEqual([]);
  });

  it("sin líneas no confirma", async () => {
    db.t.lineas.splice(0);
    expect(await confirmar(WS, "r1", 7)).toEqual({ ok: false, error: "Cargá al menos un producto." });
  });

  it("una recepción de otro negocio no existe", async () => {
    expect(await confirmar("otro", "r1", 7)).toEqual({ ok: false, error: "Esa recepción no existe." });
    expect(escrituras()).toEqual([]);
  });
});

describe("leerRecepcion y listarRecepciones", () => {
  beforeEach(() => {
    db.t.proveedores.push({ id: "prov1", workspaceId: WS, name: "Kodak" });
    db.t.recepciones.push(recepcion({ proveedorId: "prov1", comprobante: "A-1" }), recepcion({ id: "r2", numero: 2, estado: "DESCARTADA" }));
    db.t.productos.push(producto({ id: "i1", kind: "INSUMO", name: "Kit 305", costArs: null }));
    db.t.insumos.push({ id: "f1", workspaceId: WS, productId: "i1", unidad: "copias", unidadCompra: "Kit", unidadesPorCompra: 610 });
    db.t.lineas.push(linea({ productId: "i1", cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 610, costoUnitarioArs: "1000.50" }));
  });

  it("lee el detalle con producto, ficha de insumo y total", async () => {
    const r = await leerRecepcion(WS, "r1");
    expect(r).toMatchObject({
      id: "r1",
      numero: 1,
      estado: "BORRADOR",
      proveedorNombre: "Kodak",
      totalMinor: 200100,
      lineas: [
        {
          id: "l1",
          productId: "i1",
          costoUnitarioMinor: 100050,
          producto: { nombre: "Kit 305", kind: "INSUMO", unidad: "copias", costMinor: null, priceMinor: 500000, unidadCompra: "Kit", unidadesPorCompra: 610 },
        },
      ],
    });
    expect(await leerRecepcion("otro", "r1")).toBeNull();
  });

  it("lista sin las descartadas, con total y proveedor", async () => {
    const filas = await listarRecepciones(WS);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id: "r1", numero: 1, proveedorNombre: "Kodak", comprobante: "A-1", totalMinor: 200100, lineas: 1 });
  });
});
