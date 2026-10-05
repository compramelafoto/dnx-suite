import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { accessTokenMatches } from "./access-token";
import { isWellFormedPublicId } from "./order-access";

/**
 * La lectura de un pedido para su página pública. Siempre con `workspaceId` (el de la tienda de
 * la dirección) además del `publicId`: un pedido de otra institución no existe acá.
 */
const SELECT_PAGINA = {
  id: true,
  publicId: true,
  orderNumber: true,
  status: true,
  accessTokenHash: true,
  holdExpiresAt: true,
  subtotalArs: true,
  totalArs: true,
  createdAt: true,
  items: {
    orderBy: { id: "asc" },
    select: { id: true, productName: true, variantName: true, qty: true, unitPriceArs: true, lineTotalArs: true, imageUrl: true },
  },
} satisfies Prisma.StoreOrderSelect;

export type StoreOrderPageRow = Prisma.StoreOrderGetPayload<{ select: typeof SELECT_PAGINA }>;

export async function findStoreOrderForPage(workspaceId: string, publicId: string): Promise<StoreOrderPageRow | null> {
  if (!isWellFormedPublicId(publicId)) return null;
  return prisma.storeOrder.findFirst({ where: { workspaceId, publicId }, select: SELECT_PAGINA });
}

/** ¿El token abre ESTE pedido? Compara el hash guardado, en tiempo constante. */
export function tokenOpensOrder(token: string | null | undefined, order: { accessTokenHash: string }): boolean {
  return typeof token === "string" && token.length > 0 && token.length < 200 && accessTokenMatches(token, order.accessTokenHash);
}
