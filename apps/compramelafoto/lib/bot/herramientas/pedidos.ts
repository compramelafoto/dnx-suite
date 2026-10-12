import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";
import { createClientDownloadToken } from "@/lib/download-tokens";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { resendDigitalDownloadEmailForOrder } from "@/lib/zip-job-notifications";

const DAY = 24 * 60 * 60 * 1000;

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
      return o
        ? `Reenviar el link de descarga del pedido #${orderId} a ${maskEmail(o.buyerEmail)}.`
        : `(no encontré el pedido #${orderId} en tu cuenta)`;
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
      try {
        const vigente = await prisma.orderDownloadToken.findFirst({
          where: { orderId: o.id, type: "CLIENT_DIGITAL", photoId: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        });
        if (!vigente) {
          const days = resolveDownloadLinkDays(await getAppConfig());
          await createClientDownloadToken({
            orderId: o.id,
            albumId: o.albumId,
            expiresAt: new Date(Date.now() + days * DAY),
          });
        }
        const r = await resendDigitalDownloadEmailForOrder(o.id, {
          idempotencyKey: `dnx-bot-resend-${o.id}-${new Date().toISOString().slice(0, 13)}`,
        });
        if (!r.queued) {
          console.error("[dnx-bot] reenvío de link falló", { orderId: o.id, error: r.error });
          return falla;
        }
      } catch (err) {
        console.error("[dnx-bot] reenvío de link falló", { orderId: o.id, err });
        return falla;
      }
      return { ok: true, message: `Listo, le reenvié el link a ${maskEmail(o.buyerEmail)}.` };
    },
  }),
];
