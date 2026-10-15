import { describe, expect, it, vi } from "vitest";
import { applyStockMovement, type StockMovementInput } from "./variant-stock";

function stockTx(variantesActualizadas = 1) {
  return {
    stockMovement: { create: vi.fn(async () => ({})) },
    product: { update: vi.fn(async () => ({})) },
    productVariant: { updateMany: vi.fn(async () => ({ count: variantesActualizadas })) },
  };
}

const base: StockMovementInput = {
  workspaceId: "ws1",
  productId: "p1",
  variantId: null,
  qty: -2,
  reason: "VENTA",
  sourceModule: "sales",
  sourceRef: "sale1",
  note: null,
  unitCostArs: null,
  createdByUserId: 7,
};

describe("applyStockMovement", () => {
  it("sin variante: escribe el movimiento y mueve sólo el producto", async () => {
    const tx = stockTx();
    await applyStockMovement(tx as never, base);

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws1",
        productId: "p1",
        variantId: null,
        qty: -2,
        reason: "VENTA",
        sourceModule: "sales",
        sourceRef: "sale1",
        note: null,
        unitCostArs: null,
        createdByUserId: 7,
      },
    });
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQty: { decrement: 2 } } });
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("con variante: mueve la variante Y el producto por la misma cantidad", async () => {
    const tx = stockTx();
    await applyStockMovement(tx as never, { ...base, variantId: "v1", qty: 3, reason: "ENTRADA", unitCostArs: "100.00" });

    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "v1", productId: "p1", workspaceId: "ws1" },
      data: { stockQty: { increment: 3 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQty: { increment: 3 } } });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ variantId: "v1", qty: 3, reason: "ENTRADA", unitCostArs: "100.00" }),
    });
  });

  it("una variante que no es de ese producto/workspace lanza antes de escribir el movimiento", async () => {
    const tx = stockTx(0);
    await expect(applyStockMovement(tx as never, { ...base, variantId: "ajena" })).rejects.toThrow(
      "El talle no pertenece a este producto.",
    );
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("cantidad cero (un ajuste que confirma el conteo) escribe el movimiento igual", async () => {
    const tx = stockTx();
    await applyStockMovement(tx as never, { ...base, qty: 0, reason: "AJUSTE", note: "Contado" });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQty: { increment: 0 } } });
  });
});
