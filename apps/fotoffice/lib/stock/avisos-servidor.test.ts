import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prisma = {
  stockMovement: { groupBy: vi.fn() },
  product: { findMany: vi.fn() },
};
vi.mock("@repo/db", () => ({ prisma }));

const { consumo30PorProducto, itemsDeStock } = await import("./avisos-servidor");

beforeEach(() => vi.clearAllMocks());

describe("consumo30PorProducto", () => {
  it("filtra por negocio y últimos 30 días", async () => {
    prisma.stockMovement.groupBy.mockResolvedValue([]);
    const ahora = new Date("2026-10-21T12:00:00Z");
    await consumo30PorProducto("w", ahora);
    const arg = prisma.stockMovement.groupBy.mock.calls[0]![0];
    expect(arg.where.workspaceId).toBe("w");
    expect(arg.where.createdAt.gte).toEqual(new Date("2026-09-21T12:00:00Z"));
    expect(arg.where.reason.in.sort()).toEqual(["CONSUMO", "DEVOLUCION", "PEDIDO", "VENTA"]);
  });
  it("netea devoluciones y nunca da negativo", async () => {
    prisma.stockMovement.groupBy.mockResolvedValue([
      { productId: "a", reason: "VENTA", _sum: { qty: -10 } },
      { productId: "a", reason: "CONSUMO", _sum: { qty: -5 } },
      { productId: "a", reason: "DEVOLUCION", _sum: { qty: 3 } },
      { productId: "b", reason: "DEVOLUCION", _sum: { qty: 4 } },
    ]);
    const m = await consumo30PorProducto("w");
    expect(m.get("a")).toBe(12);
    expect(m.get("b")).toBe(0);
  });
});

describe("itemsDeStock", () => {
  it("arma los ítems con ficha y consumo", async () => {
    prisma.stockMovement.groupBy.mockResolvedValue([{ productId: "p1", reason: "VENTA", _sum: { qty: -30 } }]);
    prisma.product.findMany.mockResolvedValue([
      {
        id: "p1", name: "Papel", stockQty: 5, minStockQty: 10, tracksStock: true, supplierName: "Kodak",
        fotofficeInsumo: { unidad: "hojas", unidadCompra: "caja", unidadesPorCompra: 100 },
      },
      { id: "p2", name: "Marco", stockQty: 1, minStockQty: null, tracksStock: true, supplierName: null, fotofficeInsumo: null },
    ]);
    const r = await itemsDeStock("w");
    expect(prisma.product.findMany.mock.calls[0]![0].where).toEqual({ workspaceId: "w", isActive: true, tracksStock: true });
    expect(r[0]).toMatchObject({ productId: "p1", unidad: "hojas", proveedor: "Kodak", unidadCompra: "caja", unidadesPorCompra: 100, consumo30: 30 });
    expect(r[1]).toMatchObject({ productId: "p2", unidad: null, proveedor: null, consumo30: 0 });
  });
});
