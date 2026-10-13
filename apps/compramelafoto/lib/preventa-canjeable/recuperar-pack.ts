import { OrderOrigin, OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { queuePreventaPackRecoveryEmail } from "@/lib/order-confirmation-email";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

/** Respuesta genérica para no revelar si existe o no el email. */
export const RESPUESTA_RECUPERAR_PACK = "Si encontramos pedidos con ese email, te enviamos un link.";

/**
 * Busca los packs de preventa pagados del mail, crea un token nuevo por pedido
 * (revoca el anterior: el enlace viejo deja de andar) y manda un mail con los links.
 */
export async function recuperarLinksDePack(
  rawEmail: string,
  opts?: { soloPedidoId?: number },
): Promise<{ enviados: number }> {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes("@")) return { enviados: 0 };

  const orders = await prisma.order.findMany({
    where: {
      ...(opts?.soloPedidoId != null ? { id: opts.soloPedidoId } : {}),
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
      isTest: false,
      buyerEmail: { equals: email, mode: "insensitive" },
    },
    select: {
      id: true,
      album: { select: { title: true } },
    },
  });

  if (orders.length === 0) return { enviados: 0 };

  const packs: Array<{ orderId: number; albumTitle: string | null; packAccessUrl: string }> = [];
  for (const order of orders) {
    const tokenData = await createPackAccessTokenForOrder(order.id, { revokeExisting: true });
    if (!tokenData?.token) continue;
    packs.push({
      orderId: order.id,
      albumTitle: order.album?.title ?? null,
      packAccessUrl: `${APP_URL}/cliente/pack/${tokenData.token}`,
    });
  }

  if (packs.length > 0) {
    await queuePreventaPackRecoveryEmail({ email, packs });
  }

  return { enviados: packs.length };
}
