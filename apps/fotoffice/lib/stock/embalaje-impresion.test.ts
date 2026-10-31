import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { descontarEmbalajeDeImpresion } = await import("./embalaje-impresion");

const ENVOLTORIOS = [
  { id: "e1", insumoId: "sobre", tipo: "SOBRE", admiteAnchoCm: 15, admiteAltoCm: 21, piezasPorUnidad: 100, orden: 0 },
  { id: "e2", insumoId: "bolsa3545", tipo: "BOLSA", admiteAnchoCm: 35, admiteAltoCm: 45, piezasPorUnidad: null, orden: 1 },
];

function fakeTx() {
  return {
    fotofficeEmbalaje: { findMany: vi.fn(async () => ENVOLTORIOS) },
    fotofficeProductoEntrega: { findMany: vi.fn(async () => []) },
    fotofficeComboItem: { findMany: vi.fn(async () => []) },
    fotofficeRecetaInsumo: { findMany: vi.fn(async () => []) },
    product: {
      findMany: vi.fn(async () => [
        { id: "sobre", name: "Sobre 19x24" },
        { id: "bolsa3545", name: "Bolsa 35x45" },
      ]),
      update: vi.fn(async () => ({})),
    },
    stockMovement: { create: vi.fn(async () => ({})) },
    $queryRaw: vi.fn(async () => []),
  };
}
const escritos = (tx: ReturnType<typeof fakeTx>) =>
  tx.stockMovement.create.mock.calls.map((c) => (c as unknown as [{ data: { productId: string; qty: number; sourceModule: string; sourceRef: string; note: string } }])[0].data);

describe("descontarEmbalajeDeImpresion", () => {
  it("30 copias 10x15 descuentan un sobre del pedido de impresión", async () => {
    const tx = fakeTx();
    await descontarEmbalajeDeImpresion(tx as never, { workspaceId: "ws", pedidoId: "ord1", items: [{ widthCm: "10", heightCm: "15", quantity: 30 }] });
    expect(escritos(tx)).toEqual([expect.objectContaining({ productId: "sobre", qty: -1, sourceModule: "impresiones", sourceRef: "ord1", note: "consumo:embalaje" })]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("una 50x70 va en la bolsa más grande", async () => {
    const tx = fakeTx();
    await descontarEmbalajeDeImpresion(tx as never, { workspaceId: "ws", pedidoId: "ord1", items: [{ widthCm: 50, heightCm: 70, quantity: 1 }] });
    expect(escritos(tx).map((d) => [d.productId, d.qty])).toEqual([["bolsa3545", -1]]);
  });

  it("sin envoltorios no bloquea ni escribe", async () => {
    const tx = fakeTx();
    tx.fotofficeEmbalaje.findMany.mockResolvedValue([]);
    await descontarEmbalajeDeImpresion(tx as never, { workspaceId: "ws", pedidoId: "ord1", items: [{ widthCm: 10, heightCm: 15, quantity: 3 }] });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
