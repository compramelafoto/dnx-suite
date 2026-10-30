import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
// Nada de esto toca R2: el pedido de mostrador sólo lee filas.
vi.mock("@/lib/impresion/almacen", () => ({}));
vi.mock("@/lib/impresion/render", () => ({}));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const M = await import("./mostrador-servidor");
const { propuestaAutomatica } = await import("@/lib/impresion/encuadre");

const WS = "ws-1";
const P10 = { anchoMm: 102, altoMm: 152 };

/**
 * Una preparación con dos fotos de 10x15 «para mañana» (2 y 3 copias = 5 → producto c10m) y una de
 * 13x18 «para mañana» (1 copia → producto c13m). El pedido ya tiene sus trabajos: ítem 0 = c10m,
 * ítem 1 = c13m (el ítem 2 es otra cosa del ticket).
 */
function cargar(opciones: { originalGrande?: boolean } = {}) {
  B.agregar("product", { id: "c10m", workspaceId: WS, name: "Copia para mañana 10x15", priceArs: "800", costArs: "300", isActive: true, preferredProveedorId: null });
  B.agregar("product", { id: "c13m", workspaceId: WS, name: "Copia para mañana 13x18", priceArs: "1200", costArs: "500", isActive: true, preferredProveedorId: null });
  B.agregar("fotofficeProductoProyecto", { id: "r10", workspaceId: WS, productId: "c10m", circuitId: "circ", proveedorId: "lab1" });
  B.agregar("fotofficeProductoProyecto", { id: "r13", workspaceId: WS, productId: "c13m", circuitId: "circ", proveedorId: "lab2" });
  B.agregar("fotofficeProveedor", { id: "lab1", workspaceId: WS, name: "Laboratorio Uno" });
  B.agregar("fotofficeProveedor", { id: "lab2", workspaceId: WS, name: "Laboratorio Dos" });
  B.agregar("fotofficePreparacionImpresion", { id: "prep1", workspaceId: WS, destino: "LABORATORIO", estado: "PREPARANDO" });
  const px = opciones.originalGrande ? { anchoPx: 6000, altoPx: 4000 } : { anchoPx: 600, altoPx: 400 };
  const fotos = [
    { id: "o1", medida: "10x15", cantidad: 2, papel: "BRILLO" },
    { id: "o2", medida: "10x15", cantidad: 3, papel: "BRILLO" },
    { id: "o3", medida: "13x18", cantidad: 1, papel: "MATE" },
  ];
  for (const f of fotos) {
    B.agregar("fotofficeOriginalImpresion", { id: f.id, workspaceId: WS, preparacionId: "prep1", key: `impresion/ws-1/${f.id}.jpg`, nombre: `${f.id}.jpg`, tipo: "image/jpeg", estado: "LISTO", ...px });
    B.agregar("fotofficePiezaImpresion", {
      id: `p-${f.id}`, workspaceId: WS, preparacionId: "prep1", originalId: f.id, tipo: "COPIA",
      medida: f.medida, plazo: "MANANA", papel: f.papel, cantidad: f.cantidad, huella: "h",
      receta: propuestaAutomatica(px.anchoPx, px.altoPx, f.medida === "10x15" ? P10 : { anchoMm: 127, altoMm: 180 }),
    });
  }
  B.agregar("fotofficeProyecto", { id: "t10", number: "T-1", circuitId: "circ", workspaceId: WS, pedidoId: "ped1", pedidoItemIndex: 0, productId: "c10m", proveedorId: null, name: "Copias 10x15" });
  B.agregar("fotofficeProyecto", { id: "t13", number: "T-2", circuitId: "circ", workspaceId: WS, pedidoId: "ped1", pedidoItemIndex: 1, productId: "c13m", proveedorId: null, name: "Copias 13x18" });
  B.agregar("fotofficeProyecto", { id: "t-otro", number: "T-3", circuitId: "circ", workspaceId: WS, pedidoId: "ped1", pedidoItemIndex: 2, productId: "album", proveedorId: null, name: "Álbum" });
}

const datosPedido = {
  workspaceId: WS,
  preparacionId: "prep1",
  pedidoId: "ped1",
  clientId: "cli1",
  nombreCliente: "Ana Pérez",
  lineasDelPedido: [
    { productId: "c10m", itemIndex: 0 },
    { productId: "c13m", itemIndex: 1 },
    { productId: "album", itemIndex: 2 },
  ],
};

beforeEach(() => B.vaciar());

describe("crearPedidoDeMostrador", () => {
  it("crea un pedido PAGADO, sin email, con un ítem por foto atado a su trabajo y su laboratorio", async () => {
    cargar();
    const r = await M.crearPedidoDeMostrador(datosPedido);
    expect(r).toEqual({ ok: true, numero: 1, laboratorios: ["Laboratorio Dos", "Laboratorio Uno"] });

    const [pedido] = B.datos.fotofficePrintOrder;
    expect(pedido).toMatchObject({
      workspaceId: WS, number: 1, source: "MOSTRADOR", status: "PAGADO", email: null, clientId: "cli1", nombre: "Ana Pérez",
      paper: "BRILLO", delivery: "RETIRO", pricingSnapshot: { origen: "mostrador", preparacionId: "prep1", pedidoId: "ped1" },
    });
    expect(pedido!.paidAt).toBeInstanceOf(Date);
    expect(typeof pedido!.trackingToken).toBe("string");

    const items = B.datos.fotofficePrintOrderItem;
    expect(items).toHaveLength(3);
    const de = (piezaId: string) => items.find((i) => i.piezaId === piezaId)!;
    expect(de("p-o1")).toMatchObject({
      orderId: pedido!.id, proyectoId: "t10", proveedorId: "lab1", sourceKey: "impresion/ws-1/o1.jpg", sourceName: "o1.jpg",
      quantity: 2, paper: "BRILLO", plazo: "MANANA", cropX: 0, cropY: 0, cropW: 1, cropH: 1,
    });
    // La medida nominal (como los pedidos del bot): el ZIP y el resumen del laboratorio dicen «10x15».
    expect(Number(de("p-o1").widthCm)).toBe(10);
    expect(Number(de("p-o1").heightCm)).toBe(15);
    expect(Number(de("p-o3").widthCm)).toBe(13);
    expect(Number(de("p-o3").heightCm)).toBe(18);
    expect(de("p-o2")).toMatchObject({ proyectoId: "t10", proveedorId: "lab1", quantity: 3 });
    expect(de("p-o3")).toMatchObject({ proyectoId: "t13", proveedorId: "lab2", quantity: 1, paper: "MATE" });
    // Cada ítem lleva el mismo laboratorio que su trabajo.
    const trabajos = B.datos.fotofficeProyecto;
    for (const i of items) expect(trabajos.find((t) => t.id === i.proyectoId)!.proveedorId).toBe(i.proveedorId);
    expect(trabajos.find((t) => t.id === "t-otro")!.proveedorId).toBeNull();
    // La preparación ya no se puede editar.
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ estado: "LISTA" });
    // Usa el mismo candado de numeración que el bot.
    expect(B.sql.some((s) => s.texto.includes("pg_advisory_xact_lock"))).toBe(true);
  });

  it("marca calidad baja la foto que queda pixelada y no la que alcanza", async () => {
    cargar();
    await M.crearPedidoDeMostrador(datosPedido);
    expect(B.datos.fotofficePrintOrderItem.every((i) => i.calidadBaja === true)).toBe(true);
    B.vaciar();
    cargar({ originalGrande: true });
    await M.crearPedidoDeMostrador(datosPedido);
    expect(B.datos.fotofficePrintOrderItem.every((i) => i.calidadBaja === false)).toBe(true);
  });

  it("dos llamadas con la misma preparación dejan un solo pedido", async () => {
    cargar();
    const a = await M.crearPedidoDeMostrador(datosPedido);
    const b = await M.crearPedidoDeMostrador(datosPedido);
    expect(B.datos.fotofficePrintOrder).toHaveLength(1);
    expect(B.datos.fotofficePrintOrderItem).toHaveLength(3);
    expect(b).toEqual(a);
  });

  it("no mira pedidos de otro negocio con la misma preparación", async () => {
    cargar();
    B.agregar("fotofficePrintOrder", { id: "ajeno", workspaceId: "ws-2", number: 7, pricingSnapshot: { origen: "mostrador", preparacionId: "prep1" } });
    const r = await M.crearPedidoDeMostrador(datosPedido);
    expect(r).toMatchObject({ ok: true, numero: 1 });
  });

  it("si falta el trabajo de un renglón no crea nada", async () => {
    cargar();
    B.datos.fotofficeProyecto = B.datos.fotofficeProyecto.filter((t) => t.id !== "t13");
    const r = await M.crearPedidoDeMostrador(datosPedido);
    expect(r).toEqual({ ok: false, error: "No se creó el trabajo de Copia para mañana 13x18: revisá su flujo en el catálogo." });
    expect(B.datos.fotofficePrintOrder).toHaveLength(0);
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ estado: "PREPARANDO" });
  });
});

describe("comprobarTicketDeLaboratorio", () => {
  const lineas = [
    { productId: "c10m", qty: 5, unitPriceMinor: 80000 },
    { productId: "c13m", qty: 1, unitPriceMinor: 120000 },
  ];

  it("acepta las líneas que coinciden con la preparación", async () => {
    cargar();
    const r = await M.comprobarTicketDeLaboratorio(WS, "prep1", lineas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.renglones.map((x) => x.productId).sort()).toEqual(["c10m", "c13m"]);
  });

  it("con una cantidad cambiada pide volver a tocar el pedido", async () => {
    cargar();
    const r = await M.comprobarTicketDeLaboratorio(WS, "prep1", [{ ...lineas[0]!, qty: 4 }, lineas[1]!]);
    expect(r).toEqual({ ok: false, error: "Las fotos cambiaron: tocá el pedido para laboratorio y volvé a cobrar." });
  });

  it("con un precio cambiado o un renglón de más, también", async () => {
    cargar();
    expect(await M.comprobarTicketDeLaboratorio(WS, "prep1", [{ ...lineas[0]!, unitPriceMinor: 70000 }, lineas[1]!])).toMatchObject({ ok: false });
    expect(await M.comprobarTicketDeLaboratorio(WS, "prep1", [...lineas, { productId: "c10m", qty: 1, unitPriceMinor: 80000 }])).toMatchObject({ ok: false });
    expect(await M.comprobarTicketDeLaboratorio(WS, "prep1", [lineas[0]!])).toMatchObject({ ok: false });
  });

  it("rechaza un producto sin laboratorio asignado", async () => {
    cargar();
    B.datos.fotofficeProductoProyecto = B.datos.fotofficeProductoProyecto.map((r) => (r.id === "r13" ? { ...r, proveedorId: null } : r));
    const r = await M.comprobarTicketDeLaboratorio(WS, "prep1", lineas);
    expect(r).toEqual({ ok: false, error: "Copia para mañana 13x18 no tiene laboratorio asignado: cargá el proveedor en el catálogo." });
  });

  it("una preparación de otro negocio no existe", async () => {
    cargar();
    const r = await M.comprobarTicketDeLaboratorio("ws-2", "prep1", lineas);
    expect(r).toEqual({ ok: false, error: "Esa preparación no existe." });
  });
});

describe("preparacionYaCobrada", () => {
  it("no, mientras se prepara; sí, con su pedido de mostrador o LISTA; nunca mira otro negocio", async () => {
    cargar();
    expect(await M.preparacionYaCobrada(WS, "prep1")).toBe(false);
    B.agregar("fotofficePrintOrder", { id: "ajeno", workspaceId: "ws-2", number: 7, pricingSnapshot: { origen: "mostrador", preparacionId: "prep1" } });
    expect(await M.preparacionYaCobrada(WS, "prep1")).toBe(false);
    await M.crearPedidoDeMostrador(datosPedido);
    expect(await M.preparacionYaCobrada(WS, "prep1")).toBe(true);
    B.vaciar();
    cargar();
    B.datos.fotofficePreparacionImpresion[0]!.estado = "LISTA";
    expect(await M.preparacionYaCobrada(WS, "prep1")).toBe(true);
  });
});

describe("laboratorioFaltante", () => {
  it("nombra el primer renglón sin laboratorio", () => {
    const renglones = [
      { productId: "a", cantidad: 1, precioUnitario: 1, proveedorId: "lab", claves: [] },
      { productId: "b", cantidad: 1, precioUnitario: 1, proveedorId: null, claves: [] },
    ];
    expect(M.laboratorioFaltante(renglones, new Map([["b", "Copia 20x30"]]))).toBe("Copia 20x30 no tiene laboratorio asignado: cargá el proveedor en el catálogo.");
    expect(M.laboratorioFaltante(renglones.slice(0, 1), new Map())).toBeNull();
  });
});

describe("flujosQueNoSirven y su mensaje", () => {
  const circuito = (id: string, extra: Record<string, unknown> = {}, etapas: { archivedAt: Date | null }[] = [{ archivedAt: null }]) => {
    B.agregar("fotofficeCircuit", { id, workspaceId: WS, name: `Flujo ${id}`, kind: "TRABAJO", isActive: true, ...extra });
    etapas.forEach((e, i) => B.agregar("fotofficeStage", { id: `${id}-e${i}`, circuitId: id, order: i, days: 1, ...e }));
  };

  it("un producto sin regla no es problema (su trabajo va a «Para retirar»), ni uno con flujo sano", async () => {
    cargar();
    circuito("circ");
    B.agregar("product", { id: "inst10", workspaceId: WS, name: "Copia instantánea 10x15", priceArs: "500", isActive: true });
    expect(await M.flujosQueNoSirven(WS, ["c10m", "c13m", "inst10"])).toEqual([]);
    expect(await M.flujosQueNoSirven(WS, [])).toEqual([]);
  });

  it("nombra los productos con regla cuyo flujo no existe, está archivado, no es de trabajo o no tiene etapas", async () => {
    cargar();
    circuito("circ");
    circuito("archivado", { isActive: false });
    circuito("venta", { kind: "VENTA" });
    circuito("vacio", {}, [{ archivedAt: new Date() }]);
    const productos: [string, string][] = [["pBorrado", "nada"], ["pArchivado", "archivado"], ["pVenta", "venta"], ["pVacio", "vacio"]];
    for (const [id, circuitId] of productos) {
      B.agregar("product", { id, workspaceId: WS, name: `Producto ${id}`, priceArs: "100", isActive: true });
      B.agregar("fotofficeProductoProyecto", { id: `r-${id}`, workspaceId: WS, productId: id, circuitId, proveedorId: "lab1" });
    }
    expect(await M.flujosQueNoSirven(WS, ["c10m", "pBorrado", "pArchivado", "pVenta", "pVacio"])).toEqual([
      "Producto pBorrado", "Producto pArchivado", "Producto pVenta", "Producto pVacio",
    ]);
  });

  it("un flujo de otro negocio con el mismo id no cuenta como sano; una regla de otro negocio no se mira", async () => {
    cargar();
    B.agregar("fotofficeCircuit", { id: "circ", workspaceId: "ws-2", name: "Ajeno", kind: "TRABAJO", isActive: true });
    B.agregar("fotofficeStage", { id: "circ-e0", circuitId: "circ", order: 0, days: 1, archivedAt: null });
    expect(await M.flujosQueNoSirven(WS, ["c10m"])).toEqual(["Copia para mañana 10x15"]);
    B.agregar("product", { id: "c20m", workspaceId: WS, name: "Copia para mañana 20x30", priceArs: "3000", isActive: true });
    B.agregar("fotofficeProductoProyecto", { id: "r20-ajena", workspaceId: "ws-2", productId: "c20m", circuitId: "roto", proveedorId: "lab9" });
    expect(await M.flujosQueNoSirven(WS, ["c20m"])).toEqual([]);
  });

  it("arma el error exacto para el cobro", () => {
    expect(M.mensajeFlujoQueNoSirve("Copia para mañana 20x30")).toBe("El flujo de Copia para mañana 20x30 no sirve: revisalo en el catálogo antes de cobrar.");
  });
});

describe("costo del laboratorio en el trabajo", () => {
  it("cada trabajo queda con el costo unitario de su renglón por la cantidad", async () => {
    cargar();
    await M.crearPedidoDeMostrador(datosPedido);
    const t = (id: string) => B.datos.fotofficeProyecto.find((x) => x.id === id)!;
    // c10m: 5 copias a $300; c13m: 1 copia a $500.
    expect(Number(t("t10").proveedorCostoArs)).toBe(1500);
    expect(Number(t("t13").proveedorCostoArs)).toBe(500);
    expect(t("t-otro").proveedorCostoArs).toBeUndefined();
  });

  it("sin costo cargado en el producto, el costo del trabajo no se toca", async () => {
    cargar();
    B.datos.product = B.datos.product.map((p) => (p.id === "c13m" ? { ...p, costArs: null } : p));
    B.datos.fotofficeProyecto = B.datos.fotofficeProyecto.map((p) => (p.id === "t13" ? { ...p, proveedorCostoArs: "999" } : p));
    await M.crearPedidoDeMostrador(datosPedido);
    expect(B.datos.fotofficeProyecto.find((x) => x.id === "t13")!.proveedorCostoArs).toBe("999");
    expect(Number(B.datos.fotofficeProyecto.find((x) => x.id === "t10")!.proveedorCostoArs)).toBe(1500);
  });
});

describe("anotarFalloDeLaboratorio", () => {
  it("deja una nota con la preparación en cada trabajo de laboratorio del pedido, sólo de este negocio", async () => {
    cargar();
    B.agregar("fotofficeProyecto", { id: "t-ajeno", number: "T-9", circuitId: "circ-ajeno", workspaceId: "ws-2", pedidoId: "ped1", pedidoItemIndex: 0, productId: "c10m", name: "Ajeno" });
    await M.anotarFalloDeLaboratorio({ workspaceId: WS, pedidoId: "ped1", preparacionId: "prep1", itemIndexes: [0, 1], error: "se cortó la base." });
    const notas = B.datos.fotofficeProyectoNota;
    expect(notas.map((n) => n.proyectoId).sort()).toEqual(["t10", "t13"]);
    for (const n of notas) {
      expect(n).toMatchObject({
        workspaceId: WS,
        authorUserId: null,
        body: "No se pudo preparar el pedido para laboratorio (preparación prep1): se cortó la base. Avisá a sistemas.",
      });
    }
  });

  it("sin ítems de laboratorio no escribe nada", async () => {
    cargar();
    await M.anotarFalloDeLaboratorio({ workspaceId: WS, pedidoId: "ped1", preparacionId: "prep1", itemIndexes: [], error: "x" });
    expect(B.datos.fotofficeProyectoNota ?? []).toHaveLength(0);
  });
});
