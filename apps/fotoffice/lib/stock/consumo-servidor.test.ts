import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { planificarConsumo, aplicarConsumo, consumosPendientesDeDevolver, devolverConsumos } =
  await import("./consumo-servidor");
const { ajustarEmbalaje, EmbalajeInvalido } = await import("./embalaje-servidor");

type Mov = {
  workspaceId: string;
  productId: string;
  qty: number;
  reason: string;
  sourceModule: string | null;
  sourceRef: string | null;
  note: string | null;
};

function fakeTx(
  over: {
    recetas?: { productId: string; insumoId: string; quantity: number; porCada: number }[];
    combos?: { comboProductId: string; componentProductId: string; quantity: number }[];
    productos?: { id: string; kind: string }[];
    movimientos?: Mov[];
    envoltorios?: { id: string; insumoId: string; tipo: string; admiteAnchoCm: number; admiteAltoCm: number; piezasPorUnidad: number | null; orden: number; activo?: boolean; insumo: { name: string; kind: string } }[];
    entregas?: { productId: string; forma: string; anchoCm: number | null; altoCm: number | null; embalajeSiguiente: boolean; embalajeFijoId: string | null }[];
  } = {},
) {
  const recetas = over.recetas ?? [];
  const envoltorios = over.envoltorios ?? [];
  const entregas = over.entregas ?? [];
  const combos = over.combos ?? [];
  // Cada envoltorio es un insumo: aparece en `product` con su nombre.
  const productos = [...(over.productos ?? []), ...envoltorios.map((e) => ({ id: e.insumoId, kind: e.insumo.kind, name: e.insumo.name }))];
  return {
    fotofficeRecetaInsumo: {
      findMany: vi.fn(async ({ where }: { where: { productId: { in: string[] } } }) =>
        recetas.filter((r) => where.productId.in.includes(r.productId)),
      ),
    },
    fotofficeComboItem: {
      findMany: vi.fn(async ({ where }: { where: { comboProductId: { in: string[] } } }) =>
        combos.filter((c) => where.comboProductId.in.includes(c.comboProductId)),
      ),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; kind: string } }) =>
        productos.filter((p) => where.id.in.includes(p.id) && p.kind === where.kind),
      ),
      update: vi.fn(async () => ({})),
    },
    stockMovement: {
      create: vi.fn(async () => ({})),
      findMany: vi.fn(async () => over.movimientos ?? []),
    },
    fotofficeEmbalaje: {
      findMany: vi.fn(async ({ where }: { where: { activo?: boolean; insumoId?: { in: string[] } } }) =>
        envoltorios.filter(
          (e) => (where.activo === undefined || (e.activo ?? true) === where.activo) && (!where.insumoId || where.insumoId.in.includes(e.insumoId)),
        ),
      ),
    },
    fotofficeProductoEntrega: {
      findMany: vi.fn(async ({ where }: { where: { productId: { in: string[] } } }) => entregas.filter((e) => where.productId.in.includes(e.productId))),
    },
    $queryRaw: vi.fn(async () => []),
  };
}

const base = { workspaceId: "w1", sourceModule: "sales" as const, sourceRef: "s1" };

describe("planificarConsumo", () => {
  it("expande recetas y combos y devuelve los insumos a bloquear", async () => {
    const tx = fakeTx({
      recetas: [{ productId: "comp", insumoId: "kit", quantity: 2, porCada: 1 }],
      combos: [{ comboProductId: "combo", componentProductId: "comp", quantity: 1 }],
      productos: [{ id: "kit", kind: "INSUMO" }],
    });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "a", productId: "combo", qty: 3 }]);
    expect(plan.insumoIds).toEqual(["kit"]);
    expect(plan.consumos).toEqual([{ ref: "a", insumoId: "kit", qty: 6 }]);
  });

  it("receta a un producto que ya no es insumo se ignora", async () => {
    const tx = fakeTx({
      recetas: [{ productId: "p", insumoId: "kit", quantity: 1, porCada: 1 }],
      productos: [{ id: "kit", kind: "PRODUCTO" }],
    });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "a", productId: "p", qty: 1 }]);
    expect(plan.consumos).toEqual([]);
    expect(plan.insumoIds).toEqual([]);
  });

  it("sin productos no consulta nada", async () => {
    const tx = fakeTx();
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "a", productId: null, qty: 1 }]);
    expect(plan).toEqual({ insumoIds: [], consumos: [] });
    expect(tx.fotofficeRecetaInsumo.findMany).not.toHaveBeenCalled();
  });
});

describe("aplicarConsumo", () => {
  it("aplica un CONSUMO por insumo con nota consumo:item", async () => {
    const tx = fakeTx();
    await aplicarConsumo(tx as never, {
      ...base,
      plan: { insumoIds: ["kit"], consumos: [{ ref: "a", insumoId: "kit", qty: 3 }] },
      createdByUserId: 7,
    });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "w1",
        productId: "kit",
        variantId: null,
        qty: -3,
        reason: "CONSUMO",
        sourceModule: "sales",
        sourceRef: "s1",
        note: "consumo:item:a",
        unitCostArs: null,
        createdByUserId: 7,
      }),
    });
  });
});

const mov = (reason: string, qty: number, note: string, productId = "kit"): Mov => ({
  workspaceId: "w1",
  productId,
  qty,
  reason,
  sourceModule: "sales",
  sourceRef: "s1",
  note,
});

describe("consumosPendientesDeDevolver", () => {
  const q = (refs: ReadonlySet<string> | null) => ({ ...base, refs });

  it("pendientes descuenta lo ya devuelto", async () => {
    const hecho = fakeTx({
      movimientos: [mov("CONSUMO", -6, "consumo:item:a"), mov("DEVOLUCION", 6, "consumo:item:a")],
    });
    expect(await consumosPendientesDeDevolver(hecho as never, q(null))).toEqual([]);
    const sin = fakeTx({ movimientos: [mov("CONSUMO", -6, "consumo:item:a")] });
    expect(await consumosPendientesDeDevolver(sin as never, q(null))).toEqual([
      { insumoId: "kit", qty: 6, note: "consumo:item:a" },
    ]);
  });

  it("pendientes filtra por refs", async () => {
    const tx = fakeTx({
      movimientos: [mov("CONSUMO", -2, "consumo:item:a"), mov("CONSUMO", -4, "consumo:item:b")],
    });
    expect(await consumosPendientesDeDevolver(tx as never, q(new Set(["b"])))).toEqual([
      { insumoId: "kit", qty: 4, note: "consumo:item:b" },
    ]);
  });

  it("no devuelve PEDIDO ni ENTRADA", async () => {
    const tx = fakeTx({
      movimientos: [mov("ENTRADA", 5, "consumo:item:a"), mov("PEDIDO", -5, "consumo:item:a")],
    });
    expect(await consumosPendientesDeDevolver(tx as never, q(null))).toEqual([]);
  });

  it("ignora notas que no son de consumo", async () => {
    const tx = fakeTx({ movimientos: [mov("CONSUMO", -5, "item:a")] });
    expect(await consumosPendientesDeDevolver(tx as never, q(null))).toEqual([]);
  });
});

describe("devolverConsumos", () => {
  it("escribe una DEVOLUCION positiva con la misma nota", async () => {
    const tx = fakeTx();
    await devolverConsumos(tx as never, {
      workspaceId: "w1",
      pendientes: [{ insumoId: "kit", qty: 6, note: "consumo:item:a" }],
      sourceModule: "sales",
      sourceRef: "s1",
      createdByUserId: null,
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "kit",
        qty: 6,
        reason: "DEVOLUCION",
        note: "consumo:item:a",
        sourceModule: "sales",
        sourceRef: "s1",
      }),
    });
  });
});

const SOBRE = { id: "e1", insumoId: "sobre", tipo: "SOBRE", admiteAnchoCm: 15, admiteAltoCm: 21, piezasPorUnidad: 100, orden: 0, insumo: { name: "Sobre 19x24", kind: "INSUMO" } };
const BOLSA = { id: "e2", insumoId: "bolsa", tipo: "BOLSA", admiteAnchoCm: 20, admiteAltoCm: 30, piezasPorUnidad: null, orden: 1, insumo: { name: "Bolsa 20x30", kind: "INSUMO" } };
const COPIA = { productId: "copia", forma: "PIEZA_SUELTA", anchoCm: 10, altoCm: 15, embalajeSiguiente: false, embalajeFijoId: null };

describe("embalaje dentro del plan de consumo", () => {
  it("una 10x15 con el sobre configurado suma el sobre al plan y a los bloqueos", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE], entregas: [COPIA] });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "0", productId: "copia", qty: 3 }]);
    expect(plan.consumos).toEqual([{ ref: "embalaje", insumoId: "sobre", qty: 1 }]);
    expect(plan.insumoIds).toEqual(["sobre"]);
  });

  it("sin envoltorios el plan es el de siempre", async () => {
    const tx = fakeTx({ entregas: [COPIA] });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "0", productId: "copia", qty: 3 }]);
    expect(plan).toEqual({ insumoIds: [], consumos: [] });
  });

  it("modo ninguno no descuenta embalaje", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE], entregas: [COPIA] });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "0", productId: "copia", qty: 3 }], { embalaje: { modo: "ninguno" } });
    expect(plan.consumos).toEqual([]);
  });

  it("piezas sin producto (pedido de impresión) también se embalan", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE, BOLSA] });
    const plan = await planificarConsumo(tx as never, "w1", [], {
      piezasSinProducto: [{ forma: "PIEZA_SUELTA", anchoCm: 20, altoCm: 30, embalajeSiguiente: false, embalajeFijoId: null, qty: 1 }],
    });
    expect(plan.consumos).toEqual([{ ref: "embalaje", insumoId: "bolsa", qty: 1 }]);
  });

  it("elegido a mano reemplaza al calculado", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE, BOLSA], entregas: [COPIA] });
    const plan = await planificarConsumo(tx as never, "w1", [{ ref: "0", productId: "copia", qty: 3 }], {
      embalaje: { modo: "manual", elegido: [{ insumoId: "bolsa", qty: 2 }, { insumoId: "sobre", qty: 0 }] },
    });
    expect(plan.consumos).toEqual([{ ref: "embalaje", insumoId: "bolsa", qty: 2 }]);
  });

  it("elegido a mano rechaza lo que no es un envoltorio del negocio y cantidades raras", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE] });
    const manual = (elegido: { insumoId: string; qty: number }[]) =>
      planificarConsumo(tx as never, "w1", [], { embalaje: { modo: "manual", elegido } });
    await expect(manual([{ insumoId: "ajeno", qty: 1 }])).rejects.toBeInstanceOf(EmbalajeInvalido);
    await expect(manual([{ insumoId: "sobre", qty: -1 }])).rejects.toBeInstanceOf(EmbalajeInvalido);
    await expect(manual([{ insumoId: "sobre", qty: 1.5 }])).rejects.toBeInstanceOf(EmbalajeInvalido);
  });

  it("aplicarConsumo usa la nota consumo:embalaje", async () => {
    const tx = fakeTx();
    await aplicarConsumo(tx as never, {
      ...base,
      plan: { insumoIds: ["sobre"], consumos: [{ ref: "embalaje", insumoId: "sobre", qty: 1 }] },
      createdByUserId: null,
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ productId: "sobre", qty: -1, note: "consumo:embalaje" }) });
  });

  it("pendientes de devolver: el embalaje entra sin refs o si refs lo pide", async () => {
    const tx = fakeTx({ movimientos: [mov("CONSUMO", -1, "consumo:embalaje", "sobre"), mov("CONSUMO", -2, "consumo:item:a")] });
    const q = (refs: ReadonlySet<string> | null) => consumosPendientesDeDevolver(tx as never, { ...base, refs });
    expect(await q(null)).toContainEqual({ insumoId: "sobre", qty: 1, note: "consumo:embalaje" });
    expect((await q(new Set(["a"]))).map((p) => p.note)).toEqual(["consumo:item:a"]);
    expect((await q(new Set(["embalaje"]))).map((p) => p.note)).toEqual(["consumo:embalaje"]);
  });
});

describe("ajustarEmbalaje", () => {
  it("de 1 sobre a 2 sobres y 1 bolsa descuenta la diferencia", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE, BOLSA], movimientos: [mov("CONSUMO", -1, "consumo:embalaje", "sobre")] });
    await ajustarEmbalaje(tx as never, { ...base, deseado: [{ insumoId: "sobre", qty: 2 }, { insumoId: "bolsa", qty: 1 }], createdByUserId: null });
    const escritos = tx.stockMovement.create.mock.calls.map((c) => (c as unknown as [{ data: { productId: string; qty: number; reason: string; note: string } }])[0].data);
    expect(escritos.map((d) => [d.productId, d.qty, d.reason, d.note])).toEqual([
      ["bolsa", -1, "CONSUMO", "consumo:embalaje"],
      ["sobre", -1, "CONSUMO", "consumo:embalaje"],
    ]);
  });

  it("de 2 sobres a nada devuelve los dos", async () => {
    const tx = fakeTx({ envoltorios: [SOBRE], movimientos: [mov("CONSUMO", -2, "consumo:embalaje", "sobre")] });
    await ajustarEmbalaje(tx as never, { ...base, deseado: [], createdByUserId: null });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ productId: "sobre", qty: 2, reason: "DEVOLUCION", note: "consumo:embalaje" }) });
  });
});
