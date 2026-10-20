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
