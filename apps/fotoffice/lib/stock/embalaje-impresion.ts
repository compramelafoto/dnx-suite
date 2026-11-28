import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { aplicarConsumo, planificarConsumo } from "./consumo-servidor";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * El embalaje de un pedido de impresión online (copias del laboratorio): pasan por el local y se
 * entregan en sobre o bolsa (Daniel, 30/10/2026). Sus ítems no tienen producto, sólo medidas, así
 * que cada uno es una pieza suelta de esa medida. Un pedido es UNA entrega, aunque lo impriman dos
 * laboratorios. El papel no se descuenta: es del laboratorio. Corre dentro de la transacción que
 * lo pasa a PAGADO, una sola vez.
 */
export async function descontarEmbalajeDeImpresion(
  tx: Tx,
  d: { workspaceId: string; pedidoId: string; items: readonly { widthCm: unknown; heightCm: unknown; quantity: number }[] },
): Promise<void> {
  const plan = await planificarConsumo(tx, d.workspaceId, [], {
    piezasSinProducto: d.items.map((it) => ({
      forma: "PIEZA_SUELTA" as const,
      anchoCm: Number(it.widthCm),
      altoCm: Number(it.heightCm),
      embalajeSiguiente: false,
      embalajeFijoId: null,
      qty: it.quantity,
    })),
  });
  if (plan.consumos.length === 0) return;
  await lockStockRows(tx, { workspaceId: d.workspaceId, productIds: plan.insumoIds, variantIds: [] });
  await aplicarConsumo(tx, { workspaceId: d.workspaceId, plan, sourceModule: "impresiones", sourceRef: d.pedidoId, createdByUserId: null });
}
