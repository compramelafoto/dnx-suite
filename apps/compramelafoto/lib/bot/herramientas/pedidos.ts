import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { reenviarDescargaDePedido } from "@/lib/digital-download/reenviar-descarga";
import { prisma } from "@/lib/prisma";

function maskEmail(e: string | null | undefined) {
  if (!e || !e.includes("@")) return "el mail del comprador";
  const [u, d] = e.split("@");
  return `${u!.slice(0, 2)}***@${d}`;
}

const dueno = (userId: number) => ({ album: { userId, deletedAt: null }, isTest: false });

export const pedidosTools: BotTool[] = [
  defineTool({
    name: "reenviar_link_de_descarga",
    description:
      "Propone reenviarle al comprador el mail con el link de descarga de un pedido pagado. Si el link venció, genera uno nuevo.",
    kind: "write",
    input: z.strictObject({ orderId: z.number().int().positive() }),
    describe: async ({ orderId }, actor) => {
      const o = await prisma.order.findFirst({
        where: { id: orderId, ...dueno(actor.userId) },
        select: { buyerEmail: true },
      });
      // Lanzar evita crear la tarjeta de confirmación para un pedido ajeno o inexistente.
      if (!o) throw new Error(`No encontré el pedido #${orderId} en tu cuenta.`);
      return `Reenviar el link de descarga del pedido #${orderId} a ${maskEmail(o.buyerEmail)}.`;
    },
    run: async ({ orderId }, actor) => {
      const o = await prisma.order.findFirst({
        where: { id: orderId, ...dueno(actor.userId) },
        select: { id: true, status: true, albumId: true, buyerEmail: true },
      });
      if (!o) return { ok: false, message: "No encontré ese pedido en tu cuenta." };
      if (o.status !== "PAID") {
        return { ok: false, message: "Ese pedido no está pagado, así que no tiene link de descarga." };
      }
      const falla = {
        ok: false,
        message: "No pude reenviar el link en este momento. Probá de nuevo más tarde o abrí un pedido de soporte.",
        code: "RESEND_FAILED",
      };
      const r = await reenviarDescargaDePedido(
        o,
        `dnx-bot-resend-${o.id}-${new Date().toISOString().slice(0, 13)}`,
      );
      if (!r.ok) {
        console.error("[dnx-bot] reenvío de link falló", { orderId: o.id, error: r.error, err: r.causa });
        return falla;
      }
      return { ok: true, message: `Listo, le reenvié el link a ${maskEmail(o.buyerEmail)}.` };
    },
  }),
];
