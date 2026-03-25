/**
 * Job de recuperación de pedidos abandonados.
 * Detecta Order (álbum) en PENDING > 1 hora, envía Email (y opcionalmente WhatsApp) y guarda log.
 * Excluye pedidos obsoletos: si existe un pedido posterior del mismo cliente para el mismo álbum (PAID o PENDING).
 */

import { prisma } from "@/lib/prisma";
import { isOrderSuperseded } from "@/lib/order-superseded";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EMAIL_TEMPLATE_KEY = "abandoned_order_reminder";

export async function processAbandonedOrders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
  const baseUrl = process.env.APP_BASE_URL || "https://www.compramelafoto.com";

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: oneHourAgo },
    },
    include: {
      abandonedReminders: true,
      album: { select: { publicSlug: true } },
      buyerUser: { select: { name: true } },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of orders) {
    const alreadySentEmail = order.abandonedReminders.some((r) => r.channel === "EMAIL");
    if (alreadySentEmail) {
      skipped += 1;
      continue;
    }

    const { superseded, reason, newerOrderId } = await isOrderSuperseded(
      {
        id: order.id,
        albumId: order.albumId,
        buyerEmail: order.buyerEmail,
        buyerUserId: order.buyerUserId,
        buyerPhone: order.buyerPhone,
        createdAt: order.createdAt,
      },
      { includePending: true }
    );
    if (superseded && reason) {
      console.log(
        `[abandoned-orders] orderId=${order.id} skipped: ${reason}, newerOrderId=${newerOrderId ?? "?"}`
      );
      skipped += 1;
      continue;
    }

    const resumeLink =
      order.mpInitPoint ||
      (order.album?.publicSlug
        ? `${baseUrl}/a/${order.album.publicSlug}/comprar/resumen?orderId=${order.id}`
        : `${baseUrl}/a/comprar?orderId=${order.id}`);

    const buyerName = order.buyerUser?.name || "Cliente";

    try {
      const template = await getOrCreateTemplate(EMAIL_TEMPLATE_KEY, {
        name: "Recordatorio pedido abandonado",
        subject: "Tu pedido en ComprameLaFoto está pendiente - Completalo antes de que expire",
        bodyText: `Hola {{buyerName}},\n\nTu pedido en ComprameLaFoto quedó pendiente de pago.\n\nCompletalo: {{resumeLink}}\n\nSaludos,\nComprameLaFoto`,
        bodyHtml: `<p>Hola {{buyerName}},</p><p>Tu pedido en ComprameLaFoto quedó <strong>pendiente de pago</strong>.</p><p><a href="{{resumeLink}}">Completar compra</a></p><p>Saludos,<br>ComprameLaFoto</p>`,
        variables: ["buyerName", "resumeLink"],
      });

      await queueEmail({
        to: order.buyerEmail,
        subject: template.subject,
        body: template.bodyText,
        htmlBody: template.bodyHtml ?? undefined,
        templateId: template.id,
        templateData: { buyerName, resumeLink },
        priority: 3,
        idempotencyKey: `abandoned_order_${order.id}`,
      });

      await prisma.abandonedOrderReminder.create({
        data: {
          orderId: order.id,
          channel: "EMAIL",
          templateUsed: EMAIL_TEMPLATE_KEY,
          status: "SENT",
        },
      });
      sent += 1;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[abandoned-orders] Error encolando email order ${order.id}:`, errorMessage);

      await prisma.abandonedOrderReminder.create({
        data: {
          orderId: order.id,
          channel: "EMAIL",
          templateUsed: EMAIL_TEMPLATE_KEY,
          status: "FAILED",
          errorMessage: errorMessage.slice(0, 500),
        },
      });
      failed += 1;
    }
  }

  return {
    processed: orders.length,
    sent,
    failed,
    skipped,
  };
}
