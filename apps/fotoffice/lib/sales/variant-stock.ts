import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import type { StockReason } from "./constants";

/**
 * La única puerta para mover stock.
 *
 * Desde que existen los talles (decisión D4 de la tienda), la existencia de un producto con
 * variantes vive en sus variantes y `Product.stockQty` es la SUMA — una copia, igual que
 * `stockQty` ya era copia del libro de `StockMovement`. Si cada lugar que mueve stock
 * (vender, anular, entrada, ajuste, y después la tienda) escribiera las tres cosas a mano,
 * alcanza con que uno se olvide de la variante para que la suma deje de cuadrar sin que nadie
 * se entere. Por eso todo pasa por acá: un movimiento en el libro, la variante (si hay) y el
 * producto, siempre por la misma cantidad, dentro de la transacción de quien llama.
 *
 * No verifica que alcance: vender en el mostrador nunca se bloquea por falta de stock
 * (§regla 2 de Ventas, D6), así que la existencia —del producto o de un talle— puede quedar
 * negativa. Quien sí tenga que bloquear (la tienda online) lo decide ANTES de llamar.
 */

export type StockMovementInput = {
  workspaceId: string;
  productId: string;
  variantId: string | null;
  /** Firmado: la venta resta, la entrada y la devolución suman, el ajuste puede ir para los dos lados. */
  qty: number;
  reason: StockReason;
  sourceModule: string | null;
  sourceRef: string | null;
  note: string | null;
  /** Ya convertido a decimal (`minorToDecimalString`): es lo que se graba tal cual. */
  unitCostArs: string | null;
  createdByUserId: number | null;
};

type Tx = Prisma.TransactionClient | PrismaClient;

/** `decrement` para lo que resta, `increment` para lo demás: así se lee el SQL y el libro. */
function cambio(qty: number): { increment: number } | { decrement: number } {
  return qty < 0 ? { decrement: -qty } : { increment: qty };
}

export async function applyStockMovement(tx: Tx, input: StockMovementInput): Promise<void> {
  if (input.variantId !== null) {
    // La variante va PRIMERO y con `updateMany` filtrado por producto y workspace: el `where`
    // de un `update` tiene que ser único y no admite el workspace. Si el talle no es de este
    // producto (o de este negocio), no se escribe nada y la transacción entera se cae — un
    // movimiento con un talle ajeno descuadraría dos productos a la vez.
    const r = await tx.productVariant.updateMany({
      where: { id: input.variantId, productId: input.productId, workspaceId: input.workspaceId },
      data: { stockQty: cambio(input.qty) },
    });
    if (r.count !== 1) throw new Error("El talle no pertenece a este producto.");
  }

  await tx.stockMovement.create({
    data: {
      workspaceId: input.workspaceId,
      productId: input.productId,
      variantId: input.variantId,
      qty: input.qty,
      reason: input.reason,
      sourceModule: input.sourceModule,
      sourceRef: input.sourceRef,
      note: input.note,
      unitCostArs: input.unitCostArs,
      createdByUserId: input.createdByUserId,
    },
  });
  await tx.product.update({
    where: { id: input.productId },
    data: { stockQty: cambio(input.qty) },
  });
}
