import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { planificarConsumo, aplicarConsumo, consumosPendientesDeDevolver, devolverConsumos } =
  await import("./consumo-servidor");

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
  } = {},
) {
  const recetas = over.recetas ?? [];
  const combos = over.combos ?? [];
  const productos = over.productos ?? [];
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
