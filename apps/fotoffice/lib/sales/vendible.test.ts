import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFalso = vi.hoisted(() => ({
  product: { findFirst: vi.fn(), findMany: vi.fn() },
  productVariant: { findFirst: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: prismaFalso, Prisma: {} }));

const { esVendible, NO_ES_INSUMO } = await import("./vendible");
const { findProductByCode, listProducts } = await import("./repository");

beforeEach(() => {
  vi.clearAllMocks();
  prismaFalso.product.findFirst.mockResolvedValue(null);
  prismaFalso.product.findMany.mockResolvedValue([]);
  prismaFalso.productVariant.findFirst.mockResolvedValue(null);
});

describe("esVendible", () => {
  it("un insumo no se vende; producto y servicio sí", () => {
    expect(esVendible("INSUMO")).toBe(false);
    expect(esVendible("PRODUCTO")).toBe(true);
    expect(esVendible("SERVICIO")).toBe(true);
  });
});

describe("el mostrador no ofrece insumos", () => {
  it("findProductByCode excluye INSUMO en la búsqueda del producto y en la del talle", async () => {
    await findProductByCode("ws-1", "ABC");
    const where = prismaFalso.product.findFirst.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain(JSON.stringify(NO_ES_INSUMO));
    const whereTalle = prismaFalso.productVariant.findFirst.mock.calls[0]![0].where;
    expect(JSON.stringify(whereTalle)).toContain(JSON.stringify(NO_ES_INSUMO));
  });

  it("listProducts con onlyCounter excluye INSUMO", async () => {
    await listProducts("ws-1", { onlyCounter: true });
    const where = prismaFalso.product.findMany.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain(JSON.stringify(NO_ES_INSUMO));
  });
});
