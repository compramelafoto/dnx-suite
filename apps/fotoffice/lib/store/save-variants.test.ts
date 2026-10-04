import { describe, expect, it, vi } from "vitest";
import type { VariantInput } from "./variant-form";
import { saveVariants } from "./save-variants";

/**
 * Un `tx` falso en memoria, mismo molde que `lib/sales/variant-stock.test.ts`: lo que importa
 * es QUÉ se escribe y en qué orden, no Postgres. `applyStockMovement` no se mockea —es la
 * única puerta del stock y la regla 2 tiene que pasar por ella de verdad—, así que sus
 * escrituras se ven en `stockMovement.create`, `product.update` y `productVariant.updateMany`.
 */
type Existente = { id: string; name: string; stockQty: number; isActive: boolean };

function variantesTx(opts: {
  producto?: { id: string; stockQty: number } | null;
  existentes?: Existente[];
  ajenas?: { id: string; sku: string | null; barcode: string | null }[];
  creadas?: number;
} = {}) {
  const producto = opts.producto === undefined ? { id: "p1", stockQty: 0 } : opts.producto;
  // Orden en que se tocan las tablas: el bloqueo del producto tiene que ir antes de leer talles.
  const orden: string[] = [];
  return {
    orden,
    $queryRaw: vi.fn(async () => {
      orden.push("bloqueo");
      return producto ? [producto] : [];
    }),
    product: {
      update: vi.fn(async () => ({})),
    },
    productVariant: {
      findMany: vi.fn(async (args: { where: { productId?: string } }) => {
        orden.push(args.where.productId ? "talles" : "codigos");
        return args.where.productId ? (opts.existentes ?? []) : (opts.ajenas ?? []);
      }),
      findFirst: vi.fn(async () => ({ id: "nueva1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      createMany: vi.fn(async (args: { data: unknown[] }) => ({ count: opts.creadas ?? args.data.length })),
    },
    stockMovement: { create: vi.fn(async () => ({})) },
  };
}

function talle(over: Partial<VariantInput> & { name: string }): VariantInput {
  return { id: null, sku: null, barcode: null, priceMinor: null, isActive: true, sortOrder: 0, ...over };
}

const base = { workspaceId: "ws1", productId: "p1", userId: 7 };

describe("saveVariants", () => {
  it("producto de otro workspace (o inexistente) → no existe, sin escribir", async () => {
    const tx = variantesTx({ producto: null });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ name: "S" })] });
    expect(r).toEqual({ ok: false, error: "Ese producto no existe." });
    expect(tx.productVariant.createMany).not.toHaveBeenCalled();
  });

  it("bloquea la fila del producto (FOR UPDATE, filtrado por workspace) ANTES de leer los talles existentes", async () => {
    const tx = variantesTx();
    await saveVariants(tx as never, { ...base, variants: [talle({ name: "S" })] });
    expect(tx.orden[0]).toBe("bloqueo");
    expect(tx.orden.indexOf("bloqueo")).toBeLessThan(tx.orden.indexOf("talles"));
    const sql = (tx.$queryRaw.mock.calls[0] as unknown[])[0] as { sql: string; values: unknown[] };
    expect(sql.sql).toMatch(/FROM "Product"/);
    expect(sql.sql).toMatch(/"workspaceId"/);
    expect(sql.sql).toMatch(/FOR UPDATE/);
    expect(sql.values).toEqual(["p1", "ws1"]);
  });

  it("un id de talle que no es de este producto se trata como inexistente", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "S", stockQty: 0, isActive: true }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "ajeno", name: "S" })] });
    expect(r).toEqual({ ok: false, error: "Ese talle no existe." });
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("crea los talles nuevos con su orden y precio, y busca los existentes filtrando por workspace", async () => {
    const tx = variantesTx();
    const r = await saveVariants(tx as never, {
      ...base,
      variants: [talle({ name: "S", sku: "R-S", priceMinor: 150000 }), talle({ name: "M", sortOrder: 1 })],
    });
    expect(r).toEqual({ ok: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.productVariant.createMany).toHaveBeenCalledWith({
      data: [
        { workspaceId: "ws1", productId: "p1", name: "S", sku: "R-S", barcode: null, priceArs: "1500.00", isActive: true, sortOrder: 0 },
        { workspaceId: "ws1", productId: "p1", name: "M", sku: null, barcode: null, priceArs: null, isActive: true, sortOrder: 1 },
      ],
      skipDuplicates: true,
    });
    // Sin stock previo no hay nada que pasar.
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("actualiza un talle existente filtrando por producto y workspace", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "S", stockQty: 4, isActive: true }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "Small", sku: "X1" })] });
    expect(r).toEqual({ ok: true });
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "v1", productId: "p1", workspaceId: "ws1" },
      data: { name: "Small", sku: "X1", barcode: null, priceArs: null, isActive: true, sortOrder: 0 },
    });
  });

  it("regla 1: no se desactiva un talle con stock", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "S", stockQty: 3, isActive: true }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "S", isActive: false })] });
    expect(r).toEqual({ ok: false, error: "Llevá el stock de este talle a cero antes de desactivarlo." });
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("regla 1: stock negativo tampoco es cero", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "S", stockQty: -1, isActive: true }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "S", isActive: false })] });
    expect(r.ok).toBe(false);
  });

  it("regla 1: con stock en cero se puede desactivar", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "S", stockQty: 0, isActive: true }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "S", isActive: false })] });
    expect(r).toEqual({ ok: true });
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
  });

  it("nunca borra: un talle que no vino en el formulario queda como estaba", async () => {
    const tx = variantesTx({
      existentes: [
        { id: "v1", name: "S", stockQty: 0, isActive: true },
        { id: "v2", name: "M", stockQty: 2, isActive: true },
      ],
    });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "S" })] });
    expect(r).toEqual({ ok: true });
    expect(tx.productVariant.updateMany).toHaveBeenCalledTimes(1);
  });

  it("un talle nuevo con el nombre de uno que ya existe (y no vino en el formulario) → error, no un duplicado", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "M", stockQty: 0, isActive: false }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ name: "m" })] });
    expect(r).toEqual({ ok: false, error: "Ya existe el talle m. Recargá la página y probá de nuevo." });
    expect(tx.productVariant.createMany).not.toHaveBeenCalled();
  });

  it("renombrar uno y crear otro con el nombre viejo en el mismo guardado está bien", async () => {
    const tx = variantesTx({ existentes: [{ id: "v1", name: "M", stockQty: 0, isActive: true }] });
    const r = await saveVariants(tx as never, {
      ...base,
      variants: [talle({ id: "v1", name: "Mediano" }), talle({ name: "M", sortOrder: 1 })],
    });
    expect(r).toEqual({ ok: true });
  });

  it("un código ya usado por otro talle del negocio → error antes de escribir", async () => {
    const tx = variantesTx({ ajenas: [{ id: "otra", sku: "R-S", barcode: null }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ name: "S", sku: "R-S" })] });
    expect(r).toEqual({ ok: false, error: "Ya tenés otro talle con el código R-S." });
    expect(tx.productVariant.createMany).not.toHaveBeenCalled();
    expect(tx.productVariant.findMany).toHaveBeenLastCalledWith({
      where: {
        workspaceId: "ws1",
        id: { notIn: [] },
        OR: [{ sku: { in: ["R-S"] } }],
      },
      select: { id: true, sku: true, barcode: true },
    });
  });

  it("un código de barras ya usado por otro talle del negocio → error", async () => {
    const tx = variantesTx({ ajenas: [{ id: "otra", sku: null, barcode: "779123" }] });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ name: "S", barcode: "779123" })] });
    expect(r).toEqual({ ok: false, error: "Ya tenés otro talle con el código de barras 779123." });
  });

  it("si otro guardado ganó la carrera por un código, se cae todo (lanza para que la transacción vuelva atrás)", async () => {
    const tx = variantesTx({ creadas: 0 });
    await expect(saveVariants(tx as never, { ...base, variants: [talle({ name: "S", sku: "R-S" })] })).rejects.toThrow(
      "Otro talle tomó ese código mientras guardabas. Probá de nuevo.",
    );
  });

  it("regla 2: la primera vez, el stock del producto pasa al primer talle con dos ajustes", async () => {
    const tx = variantesTx({ producto: { id: "p1", stockQty: 5 } });
    const r = await saveVariants(tx as never, {
      ...base,
      variants: [talle({ name: "S" }), talle({ name: "M", sortOrder: 1 })],
    });
    expect(r).toEqual({ ok: true });

    // El primer talle se relee por nombre (createMany no devuelve ids), dentro del producto.
    expect(tx.productVariant.findFirst).toHaveBeenCalledWith({
      where: { productId: "p1", workspaceId: "ws1", name: "S" },
      select: { id: true },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.stockMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ variantId: null, qty: -5, reason: "AJUSTE", note: "Paso del stock al primer talle", createdByUserId: 7 }),
    });
    expect(tx.stockMovement.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ variantId: "nueva1", qty: 5, reason: "AJUSTE", note: "Paso del stock al primer talle" }),
    });
    // El total del producto baja y vuelve a subir por lo mismo: la suma sigue cuadrando.
    expect(tx.product.update).toHaveBeenNthCalledWith(1, { where: { id: "p1" }, data: { stockQty: { decrement: 5 } } });
    expect(tx.product.update).toHaveBeenNthCalledWith(2, { where: { id: "p1" }, data: { stockQty: { increment: 5 } } });
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "nueva1", productId: "p1", workspaceId: "ws1" },
      data: { stockQty: { increment: 5 } },
    });
  });

  it("regla 2: el stock va al primer talle ACTIVO", async () => {
    const tx = variantesTx({ producto: { id: "p1", stockQty: 2 } });
    await saveVariants(tx as never, {
      ...base,
      variants: [talle({ name: "XS", isActive: false }), talle({ name: "S", sortOrder: 1 })],
    });
    expect(tx.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: "S" }) }),
    );
  });

  it("regla 2: con stock y ningún talle activo no hay a dónde pasarlo → error", async () => {
    const tx = variantesTx({ producto: { id: "p1", stockQty: 2 } });
    const r = await saveVariants(tx as never, { ...base, variants: [talle({ name: "S", isActive: false })] });
    expect(r).toEqual({
      ok: false,
      error: "Para pasar el stock que ya tenía el producto, al menos un talle tiene que estar activo.",
    });
    expect(tx.productVariant.createMany).not.toHaveBeenCalled();
  });

  it("regla 2: si el producto ya tenía talles, agregar uno no mueve stock", async () => {
    const tx = variantesTx({
      producto: { id: "p1", stockQty: 5 },
      existentes: [{ id: "v1", name: "S", stockQty: 5, isActive: true }],
    });
    await saveVariants(tx as never, { ...base, variants: [talle({ id: "v1", name: "S" }), talle({ name: "M", sortOrder: 1 })] });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
