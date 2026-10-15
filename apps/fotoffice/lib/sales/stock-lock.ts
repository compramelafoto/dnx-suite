import "server-only";
import { Prisma } from "@repo/db";

/**
 * Bloquea (`FOR UPDATE`) las filas de stock que va a usar un pedido: primero los productos y
 * después los talles, cada grupo en orden de id. Va dentro de una transacción y ANTES de leer
 * cuánto retienen los otros pedidos (D7).
 *
 * Por qué: lo disponible es el stock menos lo retenido, y lo retenido se calcula sumando pedidos.
 * Sin el bloqueo, dos compradores que piden la última unidad al mismo tiempo leen los dos "queda
 * 1" y se crean dos pedidos. Con él, el segundo espera a que el primero confirme, y recién ahí
 * lee (READ COMMITTED: cada sentencia ve lo confirmado) y ya cuenta la retención del primero.
 *
 * Por qué ordenado: si una compra bloquea A y después B y otra B y después A, cada una espera a
 * la otra para siempre (interbloqueo). El mismo orden en todas evita eso. Productos antes que
 * talles, igual que `saveVariants`.
 *
 * Los ids van como `text[]` (son cuid): ver la nota de SQL crudo y tipos de Prisma.
 */
type LockTx = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function lockStockRows(
  tx: LockTx,
  input: { workspaceId: string; productIds: readonly string[]; variantIds: readonly string[] },
): Promise<void> {
  const productIds = [...new Set(input.productIds)].sort();
  const variantIds = [...new Set(input.variantIds)].sort();

  if (productIds.length > 0) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ANY(${productIds}::text[]) AND "workspaceId" = ${input.workspaceId} ORDER BY "id" FOR UPDATE`,
    );
  }
  if (variantIds.length > 0) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ProductVariant" WHERE "id" = ANY(${variantIds}::text[]) AND "workspaceId" = ${input.workspaceId} ORDER BY "id" FOR UPDATE`,
    );
  }
}
