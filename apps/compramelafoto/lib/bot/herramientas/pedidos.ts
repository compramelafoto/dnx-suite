import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";
import { reenviarDescargaDePedido } from "@/lib/digital-download/reenviar-descarga";
import { recuperarLinksDePack } from "@/lib/preventa-canjeable/recuperar-pack";
import { prisma } from "@/lib/prisma";

function maskEmail(e: string | null | undefined) {
  if (!e || !e.includes("@")) return "el mail del comprador";
  const [u, d] = e.split("@");
  return `${u!.slice(0, 2)}***@${d}`;
}

const dueno = (userId: number) => ({ album: { userId, deletedAt: null }, isTest: false });

const SELECT = {
  id: true, status: true, albumId: true, buyerEmail: true, origin: true, redemptionOrderId: true,
} as const;

/**
 * Un pack de preventa no tiene fotos: las fotos están en el pedido del canje (`redemptionOrderId`).
 * Sin canje, lo que la familia necesita es el link para elegirlas, no uno de descarga
 * (el 12/11/2026 se mandó la descarga vacía de los packs 3921 y 4673: «No hay fotos para descargar»).
 */
type Plan =
  | { tipo: "descarga"; orderId: number; albumId: number }
  | { tipo: "canje" };

function planDeReenvio(o: { id: number; albumId: number; origin: string; redemptionOrderId: number | null }): Plan {
  if (o.origin !== "PREVENTA_PACK") return { tipo: "descarga", orderId: o.id, albumId: o.albumId };
  if (o.redemptionOrderId != null) return { tipo: "descarga", orderId: o.redemptionOrderId, albumId: o.albumId };
  return { tipo: "canje" };
}

export const pedidosTools: BotTool[] = [
  defineTool({
    name: "reenviar_link_de_descarga",
    description:
      "Propone reenviarle al comprador el mail con el link de descarga de un pedido pagado. Si el link venció, genera uno nuevo. " +
      "Si es un pack de preventa que la familia todavía no canjeó, le reenvía el link del canje para que elija sus fotos.",
    kind: "write",
    input: z.strictObject({ orderId: z.number().int().positive() }),
    describe: async ({ orderId }, actor) => {
      const o = await prisma.order.findFirst({ where: { id: orderId, ...dueno(actor.userId) }, select: SELECT });
      // Lanzar evita crear la tarjeta de confirmación para un pedido ajeno o inexistente.
      if (!o) throw new Error(`No encontré el pedido #${orderId} en tu cuenta.`);
      if (planDeReenvio(o).tipo === "canje") {
        return `Reenviar a ${maskEmail(o.buyerEmail)} el link para canjear el pack #${orderId} (todavía no eligió sus fotos). El link anterior del canje deja de funcionar.`;
      }
      return `Reenviar el link de descarga del pedido #${orderId} a ${maskEmail(o.buyerEmail)}.`;
    },
    run: async ({ orderId }, actor) => {
      const o = await prisma.order.findFirst({ where: { id: orderId, ...dueno(actor.userId) }, select: SELECT });
      if (!o) return { ok: false, message: "No encontré ese pedido en tu cuenta." };
      if (o.status !== "PAID") {
        return { ok: false, message: "Ese pedido no está pagado, así que no tiene link de descarga." };
      }
      const falla = {
        ok: false,
        message: "No pude reenviar el link en este momento. Probá de nuevo más tarde o abrí un pedido de soporte.",
        code: "RESEND_FAILED",
      };
      const hora = new Date().toISOString().slice(0, 13);
      const plan = planDeReenvio(o);

      if (plan.tipo === "canje") {
        if (isPlaceholderEmail(o.buyerEmail)) {
          return {
            ok: false,
            code: "PACK_SIN_MAIL",
            message: `El pack #${o.id} todavía no se canjeó y no tiene un mail real cargado, así que no puedo mandarle el link. Pasale a la familia por WhatsApp el link del canje que le diste al venderlo.`,
          };
        }
        try {
          const r = await recuperarLinksDePack(o.buyerEmail!, { soloPedidoId: o.id });
          if (r.enviados === 0) return falla;
        } catch (err) {
          console.error("[dnx-bot] reenvío del link del canje falló", { orderId: o.id, err });
          return falla;
        }
        return {
          ok: true,
          message: `El pack #${o.id} todavía no se canjeó: por eso no hay fotos para descargar. Le mandé a ${maskEmail(o.buyerEmail)} un link nuevo para que elija sus fotos; cuando termine el canje le llega solo el mail de descarga.`,
        };
      }

      const r = await reenviarDescargaDePedido({ id: plan.orderId, albumId: plan.albumId }, `dnx-bot-resend-${plan.orderId}-${hora}`);
      if (!r.ok) {
        if (r.sinFotos) {
          return {
            ok: false,
            code: "SIN_FOTOS_DIGITALES",
            message: `El pedido #${o.id} no tiene fotos digitales ni videos, así que no hay nada para descargar.`,
          };
        }
        console.error("[dnx-bot] reenvío de link falló", { orderId: plan.orderId, error: r.error, err: r.causa });
        return falla;
      }
      const delCanje = plan.orderId !== o.id ? ` (las fotos del pack están en el pedido del canje #${plan.orderId})` : "";
      return { ok: true, message: `Listo, le reenvié el link a ${maskEmail(o.buyerEmail)}${delCanje}.` };
    },
  }),
];
