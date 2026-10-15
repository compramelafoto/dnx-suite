import { prisma } from "@/lib/prisma";
import { leerGuestKey } from "./identidad";

/**
 * Anota en el pedido recién creado la clave del navegador que usó DNX Bot, para medir las ventas
 * que vinieron después de una conversación. Es un extra del checkout: nunca lanza y, sin la cookie
 * del bot, no consulta la base.
 */
export async function vincularPedidoConBot(orderId: number, cookieHeader: string | null): Promise<void> {
  const botGuestKey = leerGuestKey(cookieHeader);
  if (!botGuestKey) return;
  try {
    await prisma.order.update({ where: { id: orderId }, data: { botGuestKey }, select: { id: true } });
  } catch (e) {
    console.error("[bot comprador] no se pudo vincular el pedido con el bot", { orderId, error: e instanceof Error ? e.message : String(e) });
  }
}
