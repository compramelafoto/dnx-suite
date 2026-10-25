import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
// `Prisma.sql` arma `{ strings, values }` como el real: lo usa `lockStockRows`.
vi.mock("@repo/db", () => ({
  prisma: B.prisma,
  Prisma: { JsonNull: null, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) },
}));

const P = await import("./pedidos");

/**
 * El alta manual que usa el Mostrador al cobrar una seña: con clave (un doble clic o un reintento
 * no crea dos pedidos), con las líneas «para retirar» y con el stock que la seña aparta.
 */

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA };

const NIVELES = { orders: "MANAGE", projects: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: NIVELES } as never };

const CLAVE = "clave-mostrador-0001";

function item(id: string, datos: Record<string, unknown> = {}) {
  return {
    id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 40000, descuento: null,
    modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
  };
}

const ITEMS = [item("m1"), item("m2", { productId: "prod-taza", cantidad: 2 }), item("m3", { productId: "prod-servicio" })];
const base = (extra: Record<string, unknown> = {}) => ({ clientId: "cli-1", items: ITEMS, opcion: { tipo: "CONTADO" }, ...extra });
const producto = (id: string) => B.datos.product.find((p) => p.id === id)!;
const variante = (id: string) => B.datos.productVariant.find((v) => v.id === id)!;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("product", { id: "prod-taza", workspaceId: "ws-1", name: "Taza", tracksStock: true, stockQty: 10 });
  B.agregar("product", { id: "prod-servicio", workspaceId: "ws-1", name: "Retoque", tracksStock: false, stockQty: 0 });
  B.agregar("productVariant", { id: "var-m", workspaceId: "ws-1", productId: "prod-taza", name: "M", stockQty: 4 });
  B.agregar("productVariant", { id: "var-otra", workspaceId: "ws-1", productId: "prod-servicio", name: "X", stockQty: 0 });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "projects", enabled: true });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|Pérez/);
  errores.mockRestore();
});

describe("alta con clave", () => {
  it("guarda la clave; la segunda llamada devuelve el mismo pedido sin volver a escribir nada", async () => {
    const datos = base({
      clave: CLAVE,
      paraRetirar: ["m2"],
      apartar: [{ itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 2 }],
    });
    const a = await P.crearPedidoManual(DUENO, datos, deps);
    if (!a.ok) throw new Error(a.error);
    expect(a.repetido).toBe(false);
    expect(B.datos.fotofficePedido.find((p) => p.id === a.pedidoId)).toMatchObject({ altaKey: CLAVE });

    const b = await P.crearPedidoManual(DUENO, datos, deps);
    expect(b).toMatchObject({ ok: true, repetido: true, pedidoId: a.pedidoId, numero: a.numero });
    expect(B.datos.fotofficePedido).toHaveLength(1);
    expect(B.datos.stockMovement).toHaveLength(1);
    expect(B.datos.fotofficeProyecto).toHaveLength(1);
    expect(B.datos.fotofficePedidoCuota).toHaveLength(1);
    expect(variante("var-m").stockQty).toBe(2);
    expect(producto("prod-taza").stockQty).toBe(8);
  });

  it("sin clave se comporta como siempre: dos llamadas, dos pedidos", async () => {
    const a = await P.crearPedidoManual(DUENO, base(), deps);
    const b = await P.crearPedidoManual(DUENO, base(), deps);
    expect(a).toMatchObject({ ok: true, repetido: false });
    expect(b).toMatchObject({ ok: true, repetido: false });
    expect(B.datos.fotofficePedido).toHaveLength(2);
    expect(B.datos.fotofficePedido.every((p) => p.altaKey === null)).toBe(true);
  });

  it("una clave con otro formato no se acepta", async () => {
    for (const clave of ["corta", "con espacios 1234", 12345678, "x".repeat(91)]) {
      expect((await P.crearPedidoManual(DUENO, base({ clave }), deps)).ok).toBe(false);
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
  });

  it("la misma clave en otro estudio no es el mismo pedido", async () => {
    B.agregar("fotofficePedido", {
      id: "ped-ajeno", workspaceId: "ws-2", number: "1", clientId: "cli-x", items: [], totals: {}, totalArs: "1.00", altaKey: CLAVE,
    });
    const r = await P.crearPedidoManual(DUENO, base({ clave: CLAVE }), deps);
    expect(r).toMatchObject({ ok: true, repetido: false });
    if (r.ok) expect(r.pedidoId).not.toBe("ped-ajeno");
  });

  it("si otra transacción entra con la misma clave en el medio, devuelve la ganadora y no deja nada", async () => {
    let una = false;
    B.ganchos.alEjecutarSql = (texto) => {
      if (una || !texto.includes("numeracion-candado")) return;
      una = true;
      B.agregarDeOtraTransaccion("fotofficePedido", {
        id: "pedido-ganador", workspaceId: "ws-1", number: "99", clientId: "cli-1", items: [], totals: {}, totalArs: "80000.00", altaKey: CLAVE,
      });
    };
    const r = await P.crearPedidoManual(
      DUENO,
      base({ clave: CLAVE, apartar: [{ itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 1 }] }),
      deps,
    );
    expect(r).toEqual({ ok: true, pedidoId: "pedido-ganador", numero: "99", aviso: null, repetido: true });
    expect(B.datos.fotofficePedido.map((p) => p.id)).toEqual(["pedido-ganador"]);
    expect(B.datos.stockMovement).toHaveLength(0);
    expect(producto("prod-taza").stockQty).toBe(10);
    expect(errores).not.toHaveBeenCalled();
  });
});

describe("stock apartado por la seña", () => {
  it("un producto con stock: un movimiento PEDIDO por la cantidad, con talle y la línea en la nota", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      base({ apartar: [{ itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 2 }] }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(B.datos.stockMovement).toHaveLength(1);
    expect(B.datos.stockMovement[0]).toMatchObject({
      workspaceId: "ws-1", productId: "prod-taza", variantId: "var-m", qty: -2, reason: "PEDIDO",
      sourceModule: "pedidos", sourceRef: r.pedidoId, note: "item:m2", createdByUserId: 1,
    });
    expect(variante("var-m").stockQty).toBe(2);
    expect(producto("prod-taza").stockQty).toBe(8);
  });

  it("bloquea productos y talles antes de mover el stock", async () => {
    const bloqueos: { tabla: string; movimientos: number; valores: unknown[] }[] = [];
    B.ganchos.alEjecutarSql = (texto, valores) => {
      const m = /FROM "(Product|ProductVariant)".*FOR UPDATE/s.exec(texto);
      if (m) bloqueos.push({ tabla: m[1]!, movimientos: B.datos.stockMovement.length, valores });
    };
    const r = await P.crearPedidoManual(
      DUENO,
      base({ apartar: [{ itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 1 }] }),
      deps,
    );
    expect(r.ok).toBe(true);
    expect(bloqueos).toEqual([
      { tabla: "Product", movimientos: 0, valores: [["prod-taza"], "ws-1"] },
      { tabla: "ProductVariant", movimientos: 0, valores: [["var-m"], "ws-1"] },
    ]);
    expect(B.datos.stockMovement).toHaveLength(1);
  });

  it("sin líneas que apartar no bloquea nada", async () => {
    const antes = B.sql.length;
    await P.crearPedidoManual(DUENO, base(), deps);
    expect(B.sql.slice(antes).some((q) => /FROM "(Product|ProductVariant)"/.test(q.texto))).toBe(false);
  });

  it("un producto que no controla stock no mueve nada", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      base({ apartar: [{ itemId: "m3", productId: "prod-servicio", variantId: null, cantidad: 1 }] }),
      deps,
    );
    expect(r.ok).toBe(true);
    expect(B.datos.stockMovement).toHaveLength(0);
    expect(producto("prod-servicio").stockQty).toBe(0);
  });

  it("rechaza lo que no cuadra con los ítems y no escribe nada", async () => {
    const malos: unknown[] = [
      // Un producto que no está en los ítems.
      [{ itemId: "m2", productId: "prod-servicio", variantId: null, cantidad: 1 }],
      // Un ítem que no existe.
      [{ itemId: "m9", productId: "prod-taza", variantId: null, cantidad: 1 }],
      // Un ítem a mano (sin producto).
      [{ itemId: "m1", productId: "prod-taza", variantId: null, cantidad: 1 }],
      // Un talle de otro producto, o que no existe.
      [{ itemId: "m2", productId: "prod-taza", variantId: "var-otra", cantidad: 1 }],
      [{ itemId: "m2", productId: "prod-taza", variantId: "var-nada", cantidad: 1 }],
      // Cantidades que no son enteros positivos.
      [{ itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 0 }],
      [{ itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 1.5 }],
      [{ itemId: "m2", productId: "prod-taza", variantId: null, cantidad: "2" }],
      // Más que la cantidad del ítem (2), en una línea o repartido en dos.
      [{ itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 3 }],
      [
        { itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 2 },
        { itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 1 },
      ],
      // No es una lista.
      { itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 1 },
    ];
    for (const apartar of malos) {
      expect((await P.crearPedidoManual(DUENO, base({ apartar }), deps)).ok).toBe(false);
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(B.datos.stockMovement).toHaveLength(0);
  });
});

describe("líneas para retirar", () => {
  it("un id de ítem que no existe se rechaza", async () => {
    expect((await P.crearPedidoManual(DUENO, base({ paraRetirar: ["m9"] }), deps)).ok).toBe(false);
    expect((await P.crearPedidoManual(DUENO, base({ paraRetirar: "m2" }), deps)).ok).toBe(false);
    expect((await P.crearPedidoManual(DUENO, base({ paraRetirar: [2] }), deps)).ok).toBe(false);
    expect(B.datos.fotofficePedido).toHaveLength(0);
  });

  it("las marcadas abren su trabajo en «Para retirar», con la posición del ítem", async () => {
    const r = await P.crearPedidoManual(DUENO, base({ paraRetirar: ["m2", "m3"] }), deps);
    if (!r.ok) throw new Error(r.error);
    const estandar = B.datos.fotofficeCircuit.find((c) => c.systemKey === "PARA_RETIRAR");
    const proyectos = B.datos.fotofficeProyecto.filter((p) => p.pedidoId === r.pedidoId);
    expect(proyectos.map((p) => p.pedidoItemIndex).sort()).toEqual([1, 2]);
    expect(proyectos.every((p) => p.circuitId === estandar!.id)).toBe(true);
  });
});

describe("cancelar devuelve lo apartado y no entregado", () => {
  const ITEMS_DOS = [item("m1", { productId: "prod-taza", cantidad: 2 }), item("m2", { productId: "prod-taza", cantidad: 3 })];
  const APARTAR_DOS = [
    { itemId: "m1", productId: "prod-taza", variantId: "var-m", cantidad: 2 },
    { itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 3 },
  ];

  async function pedidoConDosLineas(): Promise<string> {
    const r = await P.crearPedidoManual(
      DUENO,
      base({ items: ITEMS_DOS, paraRetirar: ["m1", "m2"], apartar: APARTAR_DOS }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    return r.pedidoId;
  }
  const devoluciones = () => B.datos.stockMovement.filter((m) => m.reason === "DEVOLUCION");
  const trabajoDe = (pedidoId: string, posicion: number) =>
    B.datos.fotofficeProyecto.find((p) => p.pedidoId === pedidoId && p.pedidoItemIndex === posicion)!;
  const recorridoDe = (proyectoId: unknown) => B.datos.fotofficeJourney.find((j) => j.subjectId === proyectoId)!;
  const etapa = (nombre: string) => B.datos.fotofficeStage.find((e) => e.name === nombre)!;

  it("ninguna línea entregada: vuelven las dos, con su talle, su nota y el mismo sourceRef", async () => {
    const id = await pedidoConDosLineas();
    expect(variante("var-m").stockQty).toBe(2);
    expect(producto("prod-taza").stockQty).toBe(5);
    expect(await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió")).toEqual({ ok: true });
    const d = devoluciones();
    expect(d).toHaveLength(2);
    expect(d.map((m) => m.qty).sort()).toEqual([2, 3]);
    expect(d.every((m) => m.sourceRef === id && m.sourceModule === "pedidos")).toBe(true);
    expect(d.find((m) => m.note === "item:m1")).toMatchObject({ variantId: "var-m", qty: 2 });
    expect(d.find((m) => m.note === "item:m2")).toMatchObject({ variantId: null, qty: 3 });
    expect(variante("var-m").stockQty).toBe(4);
    expect(producto("prod-taza").stockQty).toBe(10);
  });

  it("una línea con su trabajo cerrado TERMINADO no vuelve; la otra sí", async () => {
    const id = await pedidoConDosLineas();
    const j = recorridoDe(trabajoDe(id, 0).id);
    Object.assign(j, { stageId: null, outcome: "TERMINADO", closedAt: AHORA });
    await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió");
    expect(devoluciones().map((m) => m.note)).toEqual(["item:m2"]);
    expect(producto("prod-taza").stockQty).toBe(8);
    expect(variante("var-m").stockQty).toBe(2);
  });

  it("una línea cuyo recorrido está en la etapa Entregado no vuelve; en «Listo para retirar» sí", async () => {
    const id = await pedidoConDosLineas();
    recorridoDe(trabajoDe(id, 0).id).stageId = etapa("Entregado").id;
    recorridoDe(trabajoDe(id, 1).id).stageId = etapa("Listo para retirar").id;
    await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió");
    expect(devoluciones().map((m) => m.note)).toEqual(["item:m2"]);
  });

  it("una línea sin trabajo (Proyectos apagado) vuelve", async () => {
    const id = await pedidoConDosLineas();
    B.datos.fotofficeProyecto.length = 0;
    B.datos.fotofficeJourney.length = 0;
    await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió");
    expect(devoluciones()).toHaveLength(2);
  });

  it("cancelar dos veces no devuelve dos veces", async () => {
    const id = await pedidoConDosLineas();
    expect((await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x")).ok).toBe(true);
    expect((await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x")).ok).toBe(false);
    expect(devoluciones()).toHaveLength(2);
    expect(producto("prod-taza").stockQty).toBe(10);
  });

  it("si ya hay una devolución de esa línea, no la repite", async () => {
    const id = await pedidoConDosLineas();
    B.agregar("stockMovement", {
      workspaceId: "ws-1", productId: "prod-taza", variantId: "var-m", qty: 2, reason: "DEVOLUCION",
      sourceModule: "pedidos", sourceRef: id, note: "item:m1",
    });
    await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x");
    expect(devoluciones().map((m) => m.note).sort()).toEqual(["item:m1", "item:m2"]);
  });

  it("bloquea productos y talles antes de devolver", async () => {
    const id = await pedidoConDosLineas();
    const bloqueos: number[] = [];
    B.ganchos.alEjecutarSql = (texto) => {
      if (/FROM "(Product|ProductVariant)".*FOR UPDATE/s.test(texto)) bloqueos.push(devoluciones().length);
    };
    await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x");
    expect(bloqueos).toEqual([0, 0]);
  });

  it("un pedido sin apartados se cancela como siempre", async () => {
    const r = await P.crearPedidoManual(DUENO, base(), deps);
    if (!r.ok) throw new Error(r.error);
    const antes = B.sql.length;
    expect(await P.cambiarEstadoPedido(DUENO, r.pedidoId, "CANCELADO", "x")).toEqual({ ok: true });
    expect(B.datos.stockMovement).toHaveLength(0);
    expect(B.sql.slice(antes).some((q) => /FROM "(Product|ProductVariant)"/.test(q.texto))).toBe(false);
    expect(B.datos.fotofficePedido.find((p) => p.id === r.pedidoId)).toMatchObject({ status: "CANCELADO" });
  });
});

describe("insumos de la seña", () => {
  // El kit de la Kodak 305 se cuenta en copias 10x15: una 15x20 gasta 2. Arranca en 0, como en la
  // carga real; queda negativo y está bien (tomar un pedido nunca se frena por falta de insumo).
  beforeEach(() => {
    B.agregar("product", { id: "kit-305", workspaceId: "ws-1", name: "Kit Kodak 305 (copias 10x15)", kind: "INSUMO", tracksStock: true, stockQty: 0 });
    B.agregar("product", { id: "prod-15x20", workspaceId: "ws-1", name: "Copia 15x20", tracksStock: false, stockQty: 0 });
    B.agregar("fotofficeRecetaInsumo", { id: "rec-15x20", workspaceId: "ws-1", productId: "prod-15x20", insumoId: "kit-305", quantity: 2, porCada: 1 });
  });
  const kit = () => producto("kit-305").stockQty;
  const consumos = () => B.datos.stockMovement.filter((m) => m.reason === "CONSUMO");
  const devoluciones = () => B.datos.stockMovement.filter((m) => m.reason === "DEVOLUCION");

  it("al tomar un pedido de 10 copias 15x20 se descuentan 20 del kit", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      base({
        items: [item("c1", { productId: "prod-15x20", cantidad: 10 })],
        paraRetirar: ["c1"],
        apartar: [{ itemId: "c1", productId: "prod-15x20", variantId: null, cantidad: 10 }],
      }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    // La copia no controla stock: no hay PEDIDO, pero su receta se descuenta igual.
    expect(B.datos.stockMovement.filter((m) => m.reason === "PEDIDO")).toHaveLength(0);
    expect(consumos()).toHaveLength(1);
    expect(consumos()[0]).toMatchObject({
      workspaceId: "ws-1", productId: "kit-305", variantId: null, qty: -20, reason: "CONSUMO",
      sourceModule: "pedidos", sourceRef: r.pedidoId, note: "consumo:item:c1", createdByUserId: 1,
    });
    expect(kit()).toBe(-20);
  });

  it("un ítem que no está en `apartar` (va por su regla de proceso) igual descuenta su receta", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      base({
        items: [item("m1", { productId: "prod-taza", cantidad: 1 }), item("c1", { productId: "prod-15x20", cantidad: 4 })],
        apartar: [{ itemId: "m1", productId: "prod-taza", variantId: null, cantidad: 1 }],
      }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(consumos()).toEqual([expect.objectContaining({ productId: "kit-305", qty: -8, note: "consumo:item:c1", sourceRef: r.pedidoId })]);
    expect(kit()).toBe(-8);
  });

  it("sin nada que apartar, la receta se descuenta igual", async () => {
    const r = await P.crearPedidoManual(DUENO, base({ items: [item("c1", { productId: "prod-15x20", cantidad: 5 })] }), deps);
    if (!r.ok) throw new Error(r.error);
    expect(B.datos.stockMovement.map((m) => [m.reason, m.note, m.qty])).toEqual([["CONSUMO", "consumo:item:c1", -10]]);
  });

  it("apartar una parte del ítem descuenta igual el insumo de la cantidad completa", async () => {
    B.agregar("fotofficeRecetaInsumo", { id: "rec-taza", workspaceId: "ws-1", productId: "prod-taza", insumoId: "kit-305", quantity: 2, porCada: 1 });
    const r = await P.crearPedidoManual(
      DUENO,
      base({
        items: [item("m2", { productId: "prod-taza", cantidad: 3 })],
        // Dos renglones del mismo ítem: el insumo se calcula por ítem, una sola vez.
        apartar: [
          { itemId: "m2", productId: "prod-taza", variantId: "var-m", cantidad: 1 },
          { itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 1 },
        ],
      }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(B.datos.stockMovement.filter((m) => m.reason === "PEDIDO").map((m) => m.qty)).toEqual([-1, -1]);
    expect(consumos()).toEqual([expect.objectContaining({ productId: "kit-305", qty: -6, note: "consumo:item:m2" })]);
  });

  it("los ítems opcionales no descuentan", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      base({ items: [item("c1", { productId: "prod-15x20", cantidad: 2 }), item("c2", { productId: "prod-15x20", cantidad: 9, opcional: true })] }),
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(consumos().map((m) => [m.note, m.qty])).toEqual([["consumo:item:c1", -4]]);
  });

  it("bloquea productos e insumos en una sola llamada, antes de escribir nada", async () => {
    const bloqueos: { tabla: string; movimientos: number; valores: unknown[] }[] = [];
    B.ganchos.alEjecutarSql = (texto, valores) => {
      const m = /FROM "(Product|ProductVariant)".*FOR UPDATE/s.exec(texto);
      if (m) bloqueos.push({ tabla: m[1]!, movimientos: B.datos.stockMovement.length, valores });
    };
    const r = await P.crearPedidoManual(
      DUENO,
      base({
        items: [item("m1", { productId: "prod-taza", cantidad: 1 }), item("c1", { productId: "prod-15x20", cantidad: 3 })],
        apartar: [
          { itemId: "m1", productId: "prod-taza", variantId: "var-m", cantidad: 1 },
          { itemId: "c1", productId: "prod-15x20", variantId: null, cantidad: 3 },
        ],
      }),
      deps,
    );
    expect(r.ok).toBe(true);
    expect(bloqueos).toEqual([
      { tabla: "Product", movimientos: 0, valores: [["kit-305", "prod-15x20", "prod-taza"], "ws-1"] },
      { tabla: "ProductVariant", movimientos: 0, valores: [["var-m"], "ws-1"] },
    ]);
    expect(B.datos.stockMovement.map((m) => [m.reason, m.note])).toEqual([
      ["PEDIDO", "item:m1"],
      ["CONSUMO", "consumo:item:c1"],
    ]);
    expect(kit()).toBe(-6);
  });

  describe("al cancelar", () => {
    // Las dos líneas son tazas (controlan stock) y además gastan kit: 2 por taza.
    const ITEMS_DOS = [item("m1", { productId: "prod-taza", cantidad: 2 }), item("m2", { productId: "prod-taza", cantidad: 3 })];
    const APARTAR_DOS = [
      { itemId: "m1", productId: "prod-taza", variantId: "var-m", cantidad: 2 },
      { itemId: "m2", productId: "prod-taza", variantId: null, cantidad: 3 },
    ];
    beforeEach(() => {
      B.agregar("fotofficeRecetaInsumo", { id: "rec-taza", workspaceId: "ws-1", productId: "prod-taza", insumoId: "kit-305", quantity: 2, porCada: 1 });
    });
    async function pedidoConDosLineas(): Promise<string> {
      const r = await P.crearPedidoManual(DUENO, base({ items: ITEMS_DOS, paraRetirar: ["m1", "m2"], apartar: APARTAR_DOS }), deps);
      if (!r.ok) throw new Error(r.error);
      return r.pedidoId;
    }
    const trabajoDe = (pedidoId: string, posicion: number) =>
      B.datos.fotofficeProyecto.find((p) => p.pedidoId === pedidoId && p.pedidoItemIndex === posicion)!;
    const recorridoDe = (proyectoId: unknown) => B.datos.fotofficeJourney.find((j) => j.subjectId === proyectoId)!;

    it("ninguna entregada: vuelven los productos y los insumos de las dos líneas", async () => {
      const id = await pedidoConDosLineas();
      expect(kit()).toBe(-10);
      expect(await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió")).toEqual({ ok: true });
      const d = devoluciones();
      expect(d.filter((m) => m.productId === "prod-taza").map((m) => m.note).sort()).toEqual(["item:m1", "item:m2"]);
      expect(d.filter((m) => m.productId === "kit-305").map((m) => [m.note, m.qty]).sort()).toEqual([
        ["consumo:item:m1", 4],
        ["consumo:item:m2", 6],
      ]);
      expect(d.every((m) => m.sourceModule === "pedidos" && m.sourceRef === id)).toBe(true);
      expect(kit()).toBe(0);
      expect(producto("prod-taza").stockQty).toBe(10);
      expect(variante("var-m").stockQty).toBe(4);
    });

    it("al cancelar con una línea entregada y otra no, vuelve solo el insumo de la no entregada", async () => {
      const id = await pedidoConDosLineas();
      Object.assign(recorridoDe(trabajoDe(id, 0).id), { stageId: null, outcome: "TERMINADO", closedAt: AHORA });
      await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "Se arrepintió");
      // La no entregada (m2) devuelve su producto con la nota de siempre y su insumo con la suya.
      expect(devoluciones().map((m) => [m.productId, m.note, m.qty])).toEqual([
        ["prod-taza", "item:m2", 3],
        ["kit-305", "consumo:item:m2", 6],
      ]);
      expect(kit()).toBe(-4);
      expect(producto("prod-taza").stockQty).toBe(8);
    });

    it("cancelar dos veces no duplica", async () => {
      const id = await pedidoConDosLineas();
      expect((await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x")).ok).toBe(true);
      expect((await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x")).ok).toBe(false);
      expect(devoluciones()).toHaveLength(4);
      expect(kit()).toBe(0);
      expect(producto("prod-taza").stockQty).toBe(10);
    });

    it("un insumo ya devuelto no se repite, y no tapa la devolución del producto de esa línea", async () => {
      const id = await pedidoConDosLineas();
      // La devolución del insumo de m1 ya está; la de su producto (nota `item:m1`) no.
      B.agregar("stockMovement", {
        workspaceId: "ws-1", productId: "kit-305", variantId: null, qty: 4, reason: "DEVOLUCION",
        sourceModule: "pedidos", sourceRef: id, note: "consumo:item:m1",
      });
      await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x");
      expect(devoluciones().map((m) => m.note).sort()).toEqual(["consumo:item:m1", "consumo:item:m2", "item:m1", "item:m2"]);
      expect(producto("prod-taza").stockQty).toBe(10);
    });

    it("un producto ya devuelto no tapa la devolución de su insumo", async () => {
      const id = await pedidoConDosLineas();
      B.agregar("stockMovement", {
        workspaceId: "ws-1", productId: "prod-taza", variantId: "var-m", qty: 2, reason: "DEVOLUCION",
        sourceModule: "pedidos", sourceRef: id, note: "item:m1",
      });
      B.agregar("stockMovement", {
        workspaceId: "ws-1", productId: "prod-taza", variantId: null, qty: 3, reason: "DEVOLUCION",
        sourceModule: "pedidos", sourceRef: id, note: "item:m2",
      });
      await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x");
      expect(devoluciones().filter((m) => m.productId === "kit-305").map((m) => m.note).sort()).toEqual([
        "consumo:item:m1",
        "consumo:item:m2",
      ]);
    });

    it("bloquea productos e insumos en una sola llamada antes de devolver", async () => {
      const id = await pedidoConDosLineas();
      const bloqueos: { tabla: string; devueltas: number; valores: unknown[] }[] = [];
      B.ganchos.alEjecutarSql = (texto, valores) => {
        const m = /FROM "(Product|ProductVariant)".*FOR UPDATE/s.exec(texto);
        if (m) bloqueos.push({ tabla: m[1]!, devueltas: devoluciones().length, valores });
      };
      await P.cambiarEstadoPedido(DUENO, id, "CANCELADO", "x");
      expect(bloqueos).toEqual([
        { tabla: "Product", devueltas: 0, valores: [["kit-305", "prod-taza"], "ws-1"] },
        { tabla: "ProductVariant", devueltas: 0, valores: [["var-m"], "ws-1"] },
      ]);
    });
  });
});
