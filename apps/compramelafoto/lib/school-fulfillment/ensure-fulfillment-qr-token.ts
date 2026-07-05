import { randomBytes } from "crypto";
import type { Prisma } from "@/lib/prisma";

/**
 * Asegura que el ítem tenga fulfillmentQrToken único.
 * Si ya existe, lo devuelve; si no, genera uno URL-safe y lo persiste.
 */
export async function ensureFulfillmentQrTokenForPreCompraOrderItem(
  db: Prisma.TransactionClient,
  itemId: number
): Promise<{ token: string }> {
  const row = await db.preCompraOrderItem.findUnique({
    where: { id: itemId },
    select: { fulfillmentQrToken: true },
  });
  if (!row) {
    throw new Error(`[ensureFulfillmentQrToken] PreCompraOrderItem not found: ${itemId}`);
  }
  if (row.fulfillmentQrToken) {
    return { token: row.fulfillmentQrToken };
  }
  const token = randomBytes(18).toString("base64url");
  await db.preCompraOrderItem.update({
    where: { id: itemId },
    data: { fulfillmentQrToken: token },
  });
  return { token };
}
