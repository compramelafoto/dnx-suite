import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFalso = vi.hoisted(() => ({
  product: { findFirst: vi.fn(), findMany: vi.fn() },
  productVariant: { findFirst: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: prismaFalso, Prisma: {} }));

const { esVendible, NO_ES_INSUMO } = await import("./vendible");
const { findProductByCode, listProducts } = await import("./repository");
const { herramientasDeAtencion } = await import("@/lib/bandeja/bot/herramientas");

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

describe("onlyVendible", () => {
  it("listProducts con onlyVendible excluye INSUMO, también combinado con onlyCounter", async () => {
    await listProducts("ws-1", { onlyActive: true, onlyVendible: true });
    expect(JSON.stringify(prismaFalso.product.findMany.mock.calls[0]![0].where)).toContain(JSON.stringify(NO_ES_INSUMO));
    await listProducts("ws-1", { onlyCounter: true, onlyVendible: true, search: "x" });
    const where = prismaFalso.product.findMany.mock.calls[1]![0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.OR).toBeDefined();
  });

  it("sin onlyVendible no filtra (el resto de las pantallas sigue viendo insumos)", async () => {
    await listProducts("ws-1", { onlyActive: true });
    expect(JSON.stringify(prismaFalso.product.findMany.mock.calls[0]![0].where)).not.toContain("INSUMO");
  });

  it("el bot de atención no cotiza insumos: buscar_productos pide solo lo vendible", async () => {
    const { tools } = herramientasDeAtencion("ws-1");
    await tools.find((t) => t.name === "buscar_productos")!.run({ texto: "papel" }, { userId: 0, role: "CLIENTE", email: "", name: null });
    expect(JSON.stringify(prismaFalso.product.findMany.mock.calls[0]![0].where)).toContain(JSON.stringify(NO_ES_INSUMO));
  });
});
