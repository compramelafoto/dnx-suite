import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const tx = {
  product: { findFirst: vi.fn(), findMany: vi.fn() },
  fotofficeRecetaInsumo: { deleteMany: vi.fn(), createMany: vi.fn() },
};
vi.mock("@repo/db", () => ({
  prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
}));

const { guardarReceta } = await import("./receta-servidor");

beforeEach(() => {
  vi.clearAllMocks();
  tx.product.findFirst.mockResolvedValue({ id: "p", kind: "PRODUCTO" });
  tx.product.findMany.mockResolvedValue([{ id: "i1" }]);
});

describe("guardarReceta", () => {
  it("guarda reemplazando la lista entera", async () => {
    const r = await guardarReceta("w", "p", [{ insumoId: "i1", quantity: 1, porCada: 2 }]);
    expect(r).toEqual({ ok: true });
    expect(tx.fotofficeRecetaInsumo.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "w", productId: "p" } });
    expect(tx.fotofficeRecetaInsumo.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: "w", productId: "p", insumoId: "i1", quantity: 1, porCada: 2, order: 0 }],
    });
  });
  it("rechaza un producto de otro negocio", async () => {
    tx.product.findFirst.mockResolvedValue(null);
    expect((await guardarReceta("w", "p", [])).ok).toBe(false);
    expect(tx.fotofficeRecetaInsumo.deleteMany).not.toHaveBeenCalled();
  });
  it("rechaza que el producto sea un insumo", async () => {
    tx.product.findFirst.mockResolvedValue({ id: "p", kind: "INSUMO" });
    expect((await guardarReceta("w", "p", [])).ok).toBe(false);
  });
  it("rechaza un insumo que no es del negocio o no es insumo", async () => {
    tx.product.findMany.mockResolvedValue([]);
    expect(await guardarReceta("w", "p", [{ insumoId: "x", quantity: 1, porCada: 1 }])).toEqual({
      ok: false,
      error: "Eso no es un insumo de este negocio.",
    });
    expect(tx.fotofficeRecetaInsumo.deleteMany).not.toHaveBeenCalled();
  });
});
