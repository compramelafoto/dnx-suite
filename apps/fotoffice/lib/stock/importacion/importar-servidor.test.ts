import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentoImportado, FilaImportada } from "./esquema";

/**
 * Volcado de lo importado en el borrador, contra una base falsa en memoria. El `$transaction`
 * falso no deshace: un rechazo tiene que ocurrir antes de la primera escritura, y las pruebas
 * lo verifican mirando el registro de escrituras.
 */

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;

function coincide(fila: Fila, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const op = v as { in?: unknown[]; not?: unknown };
      if ("in" in op) return (op.in as unknown[]).includes(fila[k]);
      if ("not" in op) return fila[k] !== op.not;
      return true; // filtros por relación: los resuelve cada tabla
    }
    return fila[k] === v;
  });
}

let secuencia = 0;

function crearBase() {
  const t = {
    recepciones: [] as Fila[],
    lineas: [] as Fila[],
    productos: [] as Fila[],
    talles: [] as Fila[],
    proveedores: [] as Fila[],
    alias: [] as Fila[],
  };
  const registro: string[] = [];

  function tabla(filas: () => Fila[], nombre: string, relaciones: (f: Fila) => Fila = (f) => f) {
    const ordenadas = (w: Where | undefined, orderBy: unknown) => {
      const r = filas().filter((f) => coincide(f, w));
      const o = (Array.isArray(orderBy) ? orderBy[0] : orderBy) as Record<string, "asc" | "desc"> | undefined;
      if (o) {
        const [campo, dir] = Object.entries(o)[0];
        r.sort((a, b) => ((a[campo] as number) - (b[campo] as number)) * (dir === "desc" ? -1 : 1));
      }
      return r;
    };
    return {
      findFirst: vi.fn(async (a: { where?: Where; orderBy?: unknown } = {}) => {
        const r = ordenadas(a.where, a.orderBy)[0];
        return r ? relaciones(r) : null;
      }),
      findMany: vi.fn(async (a: { where?: Where; orderBy?: unknown } = {}) => ordenadas(a.where, a.orderBy).map(relaciones)),
      create: vi.fn(async (a: { data: Fila }) => {
        registro.push(`${nombre}.create`);
        const fila = { id: `${nombre}${++secuencia}`, ...a.data };
        filas().push(fila);
        return fila;
      }),
      createMany: vi.fn(async (a: { data: Fila[] }) => {
        registro.push(`${nombre}.createMany`);
        for (const d of a.data) filas().push({ id: `${nombre}${++secuencia}`, ...d });
        return { count: a.data.length };
      }),
      update: vi.fn(async (a: { where: Where; data: Fila }) => {
        registro.push(`${nombre}.update`);
        const fila = filas().find((f) => coincide(f, a.where));
        if (!fila) throw new Error(`${nombre}: no existe`);
        Object.assign(fila, a.data);
        return fila;
      }),
      upsert: vi.fn(async (a: { where: Record<string, Fila>; create: Fila; update: Fila }) => {
        registro.push(`${nombre}.upsert`);
        const clave = Object.values(a.where)[0];
        const fila = filas().find((f) => coincide(f, clave));
        if (fila) Object.assign(fila, a.update);
        else filas().push({ id: `${nombre}${++secuencia}`, ...a.create });
        return fila;
      }),
    };
  }

  const db = {
    t,
    registro,
    $queryRaw: vi.fn(async (q: TemplateStringsArray, ...valores: unknown[]) => {
      registro.push("lock:recepcion");
      const [id, workspaceId] = valores;
      expect(q.join("?")).toContain(`"FotofficeRecepcion"`);
      return t.recepciones.filter((r) => r.id === id && r.workspaceId === workspaceId).map((r) => ({ id: r.id, estado: r.estado }));
    }),
    fotofficeRecepcion: tabla(() => t.recepciones, "recepcion"),
    fotofficeRecepcionLinea: tabla(() => t.lineas, "linea"),
    product: tabla(() => t.productos, "product", (p) => ({ ...p, fotofficeInsumo: null })),
    productVariant: tabla(() => t.talles, "variant"),
    fotofficeProveedor: tabla(() => t.proveedores, "proveedor"),
    fotofficeAliasProveedor: {
      ...tabla(() => t.alias, "alias"),
      // Sólo alias de productos activos del negocio (el filtro por relación de `indiceParaAsociar`).
      findMany: vi.fn(async (a: { where: Where }) =>
        t.alias.filter(
          (x) => coincide(x, a.where) && t.productos.some((p) => p.id === x.productId && p.isActive && p.workspaceId === x.workspaceId),
        ),
      ),
    },
  };
  return Object.assign(db, {
    $transaction: vi.fn(async <T,>(fn: (tx: unknown) => Promise<T>) => fn(db)),
  });
}

let db = crearBase();

vi.mock("@repo/db", () => ({
  get prisma() {
    return db;
  },
}));

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ficha/adjuntos-r2", () => ({
  adjuntosR2Configurado: () => true,
  clienteR2Privado: () => ({ send: enviar }),
  bucketR2Privado: () => "privado",
}));

const { importarEnRecepcion, elegirProductoDeLineaImportada, filasDesdeLineas, claveDeArchivo, subirArchivoDeRecepcion } =
  await import("./importar-servidor");

const WS = "ws1";

function recepcion(over: Fila = {}): Fila {
  return {
    id: "r1",
    workspaceId: WS,
    numero: 1,
    estado: "BORRADOR",
    proveedorId: null,
    comprobante: null,
    fecha: new Date("2026-10-21T15:00:00Z"),
    createdAt: new Date("2026-10-21T13:00:00Z"),
    preciosConIva: true,
    archivoKey: null,
    ...over,
  };
}

function producto(over: Fila = {}): Fila {
  return { id: "p1", workspaceId: WS, name: "Kit Kodak 305", barcode: "7790000000001", sku: "K305", isActive: true, createdAt: 1, ...over };
}

function fila(over: Partial<FilaImportada> = {}): FilaImportada {
  return {
    codigo_barras: null,
    codigo_proveedor: null,
    descripcion: "Papel glossy",
    cantidad: 1,
    unidad: null,
    unidades_por_paquete: null,
    costo_unitario: null,
    alicuota_iva: null,
    subtotal: null,
    ...over,
  };
}

function doc(filas: FilaImportada[], over: Partial<DocumentoImportado> = {}): DocumentoImportado {
  return { proveedor: null, cuit: null, fecha: null, comprobante: null, precios_con_iva: null, total: null, filas, ...over };
}

const escrituras = () => db.registro.filter((r) => !r.startsWith("lock:"));

beforeEach(() => {
  db = crearBase();
  secuencia = 0;
  enviar.mockReset();
});

describe("importarEnRecepcion", () => {
  it("vuelca bultos con costo por paquete y asocia por código de barras", async () => {
    db.t.recepciones.push(recepcion());
    db.t.productos.push(producto());
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([
      fila({ codigo_barras: "7790000000001", descripcion: "Kit Kodak 305 6R", cantidad: 2, unidades_por_paquete: 640, costo_unitario: 120000.456 }),
    ]));
    expect(r).toMatchObject({ ok: true, agregadas: 1, descartadas: 0, sinAsociar: 0, cuadra: true, proveedorDetectado: null });
    expect(db.t.lineas).toHaveLength(1);
    expect(db.t.lineas[0]).toMatchObject({
      recepcionId: "r1",
      workspaceId: WS,
      productId: "p1",
      descripcionOriginal: "Kit Kodak 305 6R",
      codigoBarras: "7790000000001",
      cantidad: 2,
      enUnidadDeCompra: true,
      unidadesPorCompra: 640,
      costoUnitarioArs: "120000.46",
      origen: "IMPORTACION",
      order: 0,
    });
  });

  it("una fila suelta (1 por paquete o sin dato) no va en bultos", async () => {
    db.t.recepciones.push(recepcion());
    db.t.lineas.push({ id: "lx", recepcionId: "r1", workspaceId: WS, order: 4 });
    await importarEnRecepcion(WS, "r1", 3, "CSV", doc([fila({ unidades_por_paquete: 1, costo_unitario: 10 }), fila({ descripcion: "Marco" })]));
    const nuevas = db.t.lineas.filter((l) => l.origen === "IMPORTACION");
    expect(nuevas.map((l) => [l.enUnidadDeCompra, l.unidadesPorCompra, l.costoUnitarioArs, l.order])).toEqual([
      [false, null, "10.00", 5],
      [false, null, null, 6],
    ]);
  });

  it("Review Focus 2: cantidad 0 o negativa se lleva a 1 y la descripción vacía se descarta", async () => {
    db.t.recepciones.push(recepcion());
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([
      fila({ descripcion: "A", cantidad: 0 }),
      fila({ descripcion: "B", cantidad: -3 }),
      fila({ descripcion: "C", cantidad: 2.6 }),
      fila({ descripcion: "   " }),
      fila({ descripcion: "" }),
    ]));
    expect(r).toMatchObject({ ok: true, agregadas: 3, descartadas: 2, sinAsociar: 3, corregidas: 2 });
    expect(db.t.lineas.map((l) => [l.descripcionOriginal, l.cantidad])).toEqual([["A", 1], ["B", 1], ["C", 3]]);
  });

  it("un costo negativo queda sin costo", async () => {
    db.t.recepciones.push(recepcion());
    await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila({ costo_unitario: -5 })]));
    expect(db.t.lineas[0].costoUnitarioArs).toBeNull();
  });

  it("Review Focus 5: una recepción confirmada se rechaza sin escribir nada", async () => {
    db.t.recepciones.push(recepcion({ estado: "CONFIRMADA" }));
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { comprobante: "A 0001-1", proveedor: "Kodak" }), "clave");
    expect(r).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(escrituras()).toEqual([]);
  });

  it("una recepción de otro negocio no existe", async () => {
    db.t.recepciones.push(recepcion({ workspaceId: "otro" }));
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()]));
    expect(r).toEqual({ ok: false, error: "Esa recepción no existe." });
    expect(escrituras()).toEqual([]);
  });

  it("sin filas útiles no escribe y lo dice", async () => {
    db.t.recepciones.push(recepcion());
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila({ descripcion: "" })]));
    expect(r).toEqual({ ok: false, error: "No encontramos artículos para cargar." });
    expect(escrituras()).toEqual([]);
  });

  it("asigna el proveedor existente activo que coincide por nombre normalizado y usa sus alias", async () => {
    db.t.recepciones.push(recepcion());
    db.t.proveedores.push(
      { id: "pv0", workspaceId: WS, name: "Kodák Argentina S.A.", active: false },
      { id: "pv1", workspaceId: WS, name: "Kodák Argentina S.A.", active: true },
      { id: "pvx", workspaceId: "otro", name: "Kodak Argentina SA", active: true },
    );
    db.t.productos.push(producto({ id: "p9", barcode: null, sku: null, name: "Papel 10x15" }));
    db.t.alias.push({ id: "a1", workspaceId: WS, proveedorId: "pv1", textoNormalizado: "papel brillo x 100", productId: "p9" });
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila({ descripcion: "PAPEL brillo x100!" }), fila({ descripcion: "Papel brillo x 100" })], { proveedor: "kodak argentina s a" }));
    expect(r).toMatchObject({ ok: true, proveedorDetectado: null, sinAsociar: 1 });
    expect(db.t.recepciones[0].proveedorId).toBe("pv1");
    expect(db.t.lineas.map((l) => l.productId)).toEqual([null, "p9"]);
  });

  it("un proveedor que no existe no se crea: se devuelve como detectado", async () => {
    db.t.recepciones.push(recepcion());
    db.t.proveedores.push({ id: "pvx", workspaceId: "otro", name: "Foto Norte", active: true });
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { proveedor: "  Foto Norte " }));
    expect(r).toMatchObject({ ok: true, proveedorDetectado: "Foto Norte" });
    expect(db.t.recepciones[0].proveedorId).toBeNull();
    expect(escrituras().some((e) => e.startsWith("proveedor."))).toBe(false);
  });

  it("si la recepción ya tiene proveedor no se cambia ni se avisa", async () => {
    db.t.recepciones.push(recepcion({ proveedorId: "pv1" }));
    db.t.proveedores.push({ id: "pv1", workspaceId: WS, name: "Kodak", active: true }, { id: "pv2", workspaceId: WS, name: "Fuji", active: true });
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { proveedor: "Fuji" }));
    expect(r).toMatchObject({ ok: true, proveedorDetectado: null });
    expect(db.t.recepciones[0].proveedorId).toBe("pv1");
  });

  it("completa comprobante y fecha sólo si estaban vacíos; precios con IVA si viene", async () => {
    db.t.recepciones.push(recepcion());
    await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { comprobante: " A 0001-00001234 ", fecha: "2026-10-15", precios_con_iva: false }), "recepciones/ws1/r1/1-f.pdf");
    expect(db.t.recepciones[0]).toMatchObject({
      comprobante: "A 0001-00001234",
      fecha: new Date("2026-10-15T15:00:00Z"),
      preciosConIva: false,
      archivoKey: "recepciones/ws1/r1/1-f.pdf",
    });
  });

  it("no pisa comprobante ni fecha cargados a mano, ni el IVA si no viene", async () => {
    const fecha = new Date("2026-10-18T15:00:00Z");
    db.t.recepciones.push(recepcion({ comprobante: "B 12", fecha, preciosConIva: true }));
    await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { comprobante: "A 99", fecha: "2026-10-15", precios_con_iva: null }));
    expect(db.t.recepciones[0]).toMatchObject({ comprobante: "B 12", fecha, preciosConIva: true, archivoKey: null });
  });

  it("una fecha del documento que no se entiende no toca la de la recepción", async () => {
    const fecha = new Date("2026-10-21T15:00:00Z");
    db.t.recepciones.push(recepcion({ fecha }));
    await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila()], { fecha: "15/10/2026" }));
    expect(db.t.recepciones[0].fecha).toBe(fecha);
  });

  it("avisa si lo leído no cuadra con el total", async () => {
    db.t.recepciones.push(recepcion());
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila({ cantidad: 2, costo_unitario: 1000 })], { total: 5000 }));
    expect(r).toMatchObject({ ok: true, cuadra: false });
  });

  it("no asocia productos con talles", async () => {
    db.t.recepciones.push(recepcion());
    db.t.productos.push(producto());
    db.t.talles.push({ id: "v1", workspaceId: WS, productId: "p1" });
    const r = await importarEnRecepcion(WS, "r1", 3, "IA", doc([fila({ codigo_barras: "7790000000001" })]));
    expect(r).toMatchObject({ ok: true, sinAsociar: 1 });
    expect(db.t.lineas[0].productId).toBeNull();
  });
});

describe("elegirProductoDeLineaImportada", () => {
  function preparar(over: Fila = {}) {
    db.t.recepciones.push(recepcion({ proveedorId: "pv1" }));
    db.t.proveedores.push({ id: "pv1", workspaceId: WS, name: "Kodak", active: true });
    db.t.productos.push(producto({ id: "p2" }));
    db.t.lineas.push({ id: "l1", recepcionId: "r1", workspaceId: WS, productId: null, descripcionOriginal: "Papel Brillo x100", origen: "IMPORTACION", order: 0, ...over });
  }

  it("asigna el producto y recuerda el alias del proveedor", async () => {
    preparar();
    const r = await elegirProductoDeLineaImportada(WS, "r1", "l1", "p2");
    expect(r).toEqual({ ok: true });
    expect(db.t.lineas[0].productId).toBe("p2");
    expect(db.t.alias).toEqual([expect.objectContaining({ workspaceId: WS, proveedorId: "pv1", textoNormalizado: "papel brillo x100", productId: "p2" })]);
  });

  it("una línea cargada a mano no guarda alias", async () => {
    preparar({ origen: "MANUAL" });
    await elegirProductoDeLineaImportada(WS, "r1", "l1", "p2");
    expect(db.t.lineas[0].productId).toBe("p2");
    expect(db.t.alias).toEqual([]);
  });

  it("sin proveedor no guarda alias", async () => {
    preparar();
    db.t.recepciones[0].proveedorId = null;
    await elegirProductoDeLineaImportada(WS, "r1", "l1", "p2");
    expect(db.t.alias).toEqual([]);
  });

  it("un producto ajeno o con talles se rechaza sin escribir", async () => {
    preparar();
    db.t.productos.push(producto({ id: "p3", workspaceId: "otro" }), producto({ id: "p4" }));
    db.t.talles.push({ id: "v", workspaceId: WS, productId: "p4" });
    expect(await elegirProductoDeLineaImportada(WS, "r1", "l1", "p3")).toEqual({ ok: false, error: "Ese producto no existe o está dado de baja." });
    expect(await elegirProductoDeLineaImportada(WS, "r1", "l1", "p4")).toEqual({ ok: false, error: "Ese producto tiene talles: cargalo desde Stock." });
    expect(escrituras()).toEqual([]);
  });

  it("una recepción confirmada se rechaza sin escribir", async () => {
    preparar();
    db.t.recepciones[0].estado = "CONFIRMADA";
    expect(await elegirProductoDeLineaImportada(WS, "r1", "l1", "p2")).toEqual({ ok: false, error: "Esa recepción ya está confirmada." });
    expect(escrituras()).toEqual([]);
  });

  it("una línea de otra recepción no existe", async () => {
    preparar({ recepcionId: "r2" });
    expect(await elegirProductoDeLineaImportada(WS, "r1", "l1", "p2")).toEqual({ ok: false, error: "Esa línea no existe." });
    expect(escrituras()).toEqual([]);
  });
});

describe("filasDesdeLineas", () => {
  it("arma las filas de la plantilla con las líneas de la recepción", () => {
    const filas = filasDesdeLineas([
      {
        codigoBarras: "779",
        descripcionOriginal: "Kit",
        cantidad: 2,
        enUnidadDeCompra: true,
        unidadesPorCompra: 640,
        costoUnitarioMinor: 12000050,
        producto: { kind: "INSUMO", unidadCompra: "kit" },
      },
      {
        codigoBarras: null,
        descripcionOriginal: "Marco",
        cantidad: 1,
        enUnidadDeCompra: false,
        unidadesPorCompra: null,
        costoUnitarioMinor: null,
        producto: null,
      },
    ]);
    expect(filas).toEqual([
      { codigo_barras: "779", codigo_proveedor: null, descripcion: "Kit", cantidad: 2, unidad: "kit", unidades_por_paquete: 640, costo_unitario: 120000.5, alicuota_iva: null, subtotal: null, tipo: "INSUMO" },
      { codigo_barras: null, codigo_proveedor: null, descripcion: "Marco", cantidad: 1, unidad: null, unidades_por_paquete: null, costo_unitario: null, alicuota_iva: null, subtotal: null, tipo: null },
    ]);
  });
});

describe("archivo original en R2", () => {
  it("arma la clave con el negocio, la recepción, la hora y el nombre saneado", () => {
    expect(claveDeArchivo("ws1", "r1", "Factura Kodak (oct)/../ñ.PDF", 1700)).toBe("recepciones/ws1/r1/1700-Factura-Kodak-oct-n.PDF");
    expect(claveDeArchivo("ws1", "r1", "", 5)).toBe("recepciones/ws1/r1/5-archivo");
  });

  it("sube al bucket privado y devuelve la clave", async () => {
    enviar.mockResolvedValue({});
    const k = await subirArchivoDeRecepcion("ws1", "r1", { nombre: "f.pdf", tipo: "application/pdf", bytes: Buffer.from("x") }, 9);
    expect(k).toBe("recepciones/ws1/r1/9-f.pdf");
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].input).toMatchObject({ Bucket: "privado", Key: k, ContentType: "application/pdf" });
  });

  it("si la subida falla, devuelve null y lo registra", async () => {
    enviar.mockRejectedValue(new Error("R2 caído"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const k = await subirArchivoDeRecepcion("ws1", "r1", { nombre: "f.pdf", tipo: "application/pdf", bytes: Buffer.from("x") }, 9);
    expect(k).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
