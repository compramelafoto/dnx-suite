import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Fila = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const B = vi.hoisted(() => ({ tx: null as any, prisma: null as any, asegurar: vi.fn(async () => {}) })); // eslint-disable-line @typescript-eslint/no-explicit-any
vi.mock("@repo/db", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(B.tx),
  },
}));
vi.mock("@/lib/impresion/configuracion", () => ({ asegurarConfiguracion: B.asegurar }));

const { KODAK_305, entradaEnUnidades, asegurarKodak305 } = await import("./kodak305");

describe("entradaEnUnidades", () => {
  it("en unidad de compra multiplica la cantidad y reparte el costo por unidad", () => {
    expect(
      entradaEnUnidades({ cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 640, costoMinor: 12_000_000 }),
    ).toEqual({ qty: 1280, unitCostMinor: 18750 });
  });
  it("sin unidad de compra queda igual", () => {
    expect(
      entradaEnUnidades({ cantidad: 5, enUnidadDeCompra: false, unidadesPorCompra: 640, costoMinor: 300 }),
    ).toEqual({ qty: 5, unitCostMinor: 300 });
    expect(
      entradaEnUnidades({ cantidad: 5, enUnidadDeCompra: true, unidadesPorCompra: null, costoMinor: null }),
    ).toEqual({ qty: 5, unitCostMinor: null });
  });
  it("sin costo no inventa uno", () => {
    expect(
      entradaEnUnidades({ cantidad: 1, enUnidadDeCompra: true, unidadesPorCompra: 640, costoMinor: null }),
    ).toEqual({ qty: 640, unitCostMinor: null });
  });
});

it("la Kodak 305 gasta 2 por hoja de 13x18", () => {
  expect(KODAK_305.consumoPorTamano["13x18"]).toBe(2);
});

function fakeTx(
  over: {
    salida?: boolean;
    consumos?: Fila[];
    productos?: Fila[];
    insumos?: Fila[];
  } = {},
) {
  const tamanos = [
    { id: "t10", nombre: "10x15" },
    { id: "t13", nombre: "13x18" },
    { id: "t15", nombre: "15x20" },
  ];
  const consumos = over.consumos ?? [];
  const productos = over.productos ?? [];
  const insumos = over.insumos ?? [];
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    fotofficeSalidaImpresion: {
      findFirst: vi.fn(async () => (over.salida === false ? null : { id: "s1" })),
    },
    fotofficeSalidaTamano: {
      findMany: vi.fn(async () => tamanos.map((t) => ({ tamano: t }))),
    },
    fotofficeConsumoTamano: {
      findMany: vi.fn(async () => consumos),
      create: vi.fn(async ({ data }: { data: Fila }) => {
        consumos.push(data);
        return data;
      }),
    },
    product: {
      findFirst: vi.fn(async ({ where }: { where: Fila }) =>
        productos.find((p) => p.name === where.name && p.kind === where.kind) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Fila }) => {
        const p = { id: "nuevo", ...data };
        productos.push(p);
        return p;
      }),
    },
    fotofficeInsumo: {
      upsert: vi.fn(async ({ create }: { create: Fila }) => {
        insumos.push(create);
        return create;
      }),
    },
    stockMovement: { create: vi.fn() },
  };
  return { tx, consumos, productos, insumos };
}

describe("asegurarKodak305", () => {
  it("crea el insumo, su ficha y los tres consumos, sin tocar la existencia", async () => {
    const f = fakeTx();
    B.tx = f.tx;
    const r = await asegurarKodak305("ws-1");
    expect(r).toEqual({ ok: true, insumoId: "nuevo", creado: true });
    expect(B.asegurar).toHaveBeenCalledWith("ws-1");
    expect(f.tx.$executeRaw).toHaveBeenCalled();
    expect(f.productos[0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "INSUMO",
      name: "Kit Kodak 305 (copias 10x15)",
      tracksStock: true,
      stockQty: 0,
    });
    expect(f.insumos[0]).toMatchObject({ productId: "nuevo", unidad: "copias 10x15", unidadesPorCompra: 640 });
    expect(f.consumos.map((c) => [c.tamanoId, c.quantity])).toEqual([
      ["t10", 1],
      ["t13", 2],
      ["t15", 2],
    ]);
    expect(f.tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("si falta la salida, avisa", async () => {
    B.tx = fakeTx({ salida: false }).tx;
    expect(await asegurarKodak305("ws-1")).toEqual({
      ok: false,
      error: "No encontramos la Kodak 305 en Impresión.",
    });
  });

  it("reusa el insumo ya ligado a consumos de la salida y completa los que faltan", async () => {
    const f = fakeTx({ consumos: [{ salidaId: "s1", tamanoId: "t10", insumoId: "viejo", quantity: 1 }] });
    B.tx = f.tx;
    const r = await asegurarKodak305("ws-1");
    expect(r).toEqual({ ok: true, insumoId: "viejo", creado: false });
    expect(f.tx.product.create).not.toHaveBeenCalled();
    expect(f.consumos.map((c) => c.tamanoId)).toEqual(["t10", "t13", "t15"]);
  });

  it("reusa un insumo con el nombre exacto si no hay consumos", async () => {
    const f = fakeTx({ productos: [{ id: "p9", kind: "INSUMO", name: "Kit Kodak 305 (copias 10x15)" }] });
    B.tx = f.tx;
    expect(await asegurarKodak305("ws-1")).toEqual({ ok: true, insumoId: "p9", creado: false });
    expect(f.tx.product.create).not.toHaveBeenCalled();
    expect(f.insumos[0]).toMatchObject({ productId: "p9" });
  });
});
