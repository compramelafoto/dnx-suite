/**
 * Servicio principal de entrega post-compra por WhatsApp.
 * Ejecuta la lógica: ≤N fotos → enviar una por una; >N fotos → enviar link (opcional 1 destacada).
 */

import { prisma } from "@/lib/prisma";
import { getSignedUrlForFile, urlToR2Key } from "@/lib/r2-client";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import { getWhatsAppDeliveryConfig } from "./config";
import { sendTextMessage } from "./sendTextMessage";
import { sendImageMessage } from "./sendImageMessage";
import { formatPhoneForWhatsApp } from "./formatPhone";

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

// Mensajes centralizados (luego reemplazables por templates)
const MESSAGES = {
  initial: (nombre: string) =>
    `Hola ${nombre} 👋\nTu compra en ComprameLaFoto fue confirmada.\nTe enviamos tus fotos por este medio y también vas a recibir el email con tu descarga.`,
  final: (linkPedido: string) =>
    `Listo 🙌 Ya te enviamos tus fotos.\nTambién podés acceder a tu pedido desde acá: ${linkPedido}`,
  linkOnly: (nombre: string, linkPedido: string) =>
    `Hola ${nombre} 👋\nTu compra en ComprameLaFoto fue confirmada.\nComo tu pedido incluye varias fotos, te dejamos el acceso directo para descargar todo desde acá: ${linkPedido}`,
};

async function createDeliveryLog(
  orderId: number,
  type: string,
  options: { mediaUrl?: string; waMessageId?: string; status?: string; errorMessage?: string }
) {
  return prisma.whatsAppDeliveryLog.create({
    data: {
      orderId,
      type,
      mediaUrl: options.mediaUrl ?? null,
      waMessageId: options.waMessageId ?? null,
      status: options.status ?? "PENDING",
      errorMessage: options.errorMessage ?? null,
      sentAt: options.status === "SENT" ? new Date() : null,
    },
  });
}

async function updateLogSent(logId: string, waMessageId?: string) {
  await prisma.whatsAppDeliveryLog.update({
    where: { id: logId },
    data: { status: "SENT", sentAt: new Date(), waMessageId: waMessageId ?? undefined },
  });
}

async function updateLogFailed(logId: string, errorMessage: string) {
  await prisma.whatsAppDeliveryLog.update({
    where: { id: logId },
    data: { status: "FAILED", errorMessage: errorMessage },
  });
}

/**
 * Verifica si ya existe entrega exitosa para este pedido (evitar duplicados).
 */
async function hasSuccessfulDelivery(orderId: number): Promise<boolean> {
  const completed = await prisma.whatsAppDeliveryLog.findFirst({
    where: {
      orderId,
      status: "SENT",
      type: { in: ["LINK_ONLY", "FINAL_MESSAGE", "FEATURED_PHOTO"] },
    },
  });
  return !!completed;
}

/**
 * Entrega el pedido por WhatsApp según la configuración y cantidad de fotos.
 */
export async function deliverOrderByWhatsApp(orderId: number): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  sent?: number;
  failed?: number;
}> {
  const config = await getWhatsAppDeliveryConfig();

  if (!config.whatsappEnabled || !config.whatsappDeliveryEnabledForPaidOrders) {
    return { ok: true, skipped: true, reason: "WhatsApp deshabilitado" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { productType: "DIGITAL" },
        include: { photo: { select: { id: true, originalKey: true } } },
      },
      album: { select: { publicSlug: true } },
    },
  });

  if (!order) {
    return { ok: false, reason: "Pedido no encontrado" };
  }

  const phone = order.buyerPhone?.trim();
  if (!phone || !formatPhoneForWhatsApp(phone)) {
    return { ok: true, skipped: true, reason: "Sin teléfono válido" };
  }

  const hasDigital = order.items.some((i) => i.productType === "DIGITAL");
  if (!hasDigital) {
    return { ok: true, skipped: true, reason: "Pedido sin fotos digitales" };
  }

  if (await hasSuccessfulDelivery(orderId)) {
    return { ok: true, skipped: true, reason: "Ya entregado por WhatsApp" };
  }

  const customerName = order.buyerEmail?.split("@")[0] || "Cliente";
  const orderLink =
    order.album?.publicSlug
      ? `${APP_BASE_URL}/a/${order.album.publicSlug}/comprar/resumen?orderId=${orderId}`
      : `${APP_BASE_URL}/cliente/pedidos`;

  const tokens = await getOrderDownloadTokens(orderId);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  const downloadUrl = clientToken
    ? `${APP_BASE_URL}/api/downloads/${clientToken.token}`
    : orderLink;

  const photoIds = [...new Set(order.items.map((i) => i.photoId).filter(Boolean))];
  const maxPhotos = Math.max(1, config.whatsappMaxPhotosToSend);
  const sendPhotosIndividually = photoIds.length <= maxPhotos;

  let sent = 0;
  let failed = 0;

  try {
    if (sendPhotosIndividually) {
      // ≤ N fotos: mensaje inicial + fotos una por una + mensaje final
      if (config.whatsappSendInitialMessage) {
        const log = await createDeliveryLog(orderId, "INITIAL_MESSAGE", { status: "PENDING" });
        const result = await sendTextMessage(phone, MESSAGES.initial(customerName));
        if (result.success) {
          await updateLogSent(log.id, result.messageId);
          sent += 1;
        } else {
          await updateLogFailed(log.id, result.error || "Error desconocido");
          failed += 1;
        }
      }

      for (const item of order.items) {
        const photo = item.photo;
        if (!photo?.originalKey) continue;

        const r2Key = urlToR2Key(photo.originalKey);
        let imageUrl: string;
        try {
          imageUrl = await getSignedUrlForFile(r2Key, 24 * 60 * 60);
        } catch (err) {
          const log = await createDeliveryLog(orderId, "PHOTO", {
            mediaUrl: photo.originalKey,
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          failed += 1;
          continue;
        }

        const log = await createDeliveryLog(orderId, "PHOTO", {
          mediaUrl: imageUrl,
          status: "PENDING",
        });

        const result = await sendImageMessage(phone, imageUrl);
        if (result.success) {
          await updateLogSent(log.id, result.messageId);
          sent += 1;
        } else {
          await updateLogFailed(log.id, result.error || "Error desconocido");
          failed += 1;
        }
      }

      if (config.whatsappSendFinalMessage) {
        const log = await createDeliveryLog(orderId, "FINAL_MESSAGE", { status: "PENDING" });
        const result = await sendTextMessage(phone, MESSAGES.final(orderLink));
        if (result.success) {
          await updateLogSent(log.id, result.messageId);
          sent += 1;
        } else {
          await updateLogFailed(log.id, result.error || "Error desconocido");
          failed += 1;
        }
      }
    } else {
      // > N fotos: solo mensaje con link (opcional: 1 foto destacada)
      if (config.whatsappSendDownloadLinkForLargeOrders) {
        const log = await createDeliveryLog(orderId, "LINK_ONLY", { status: "PENDING" });
        const result = await sendTextMessage(
          phone,
          MESSAGES.linkOnly(customerName, downloadUrl)
        );
        if (result.success) {
          await updateLogSent(log.id, result.messageId);
          sent += 1;
        } else {
          await updateLogFailed(log.id, result.error || "Error desconocido");
          failed += 1;
        }
      }
    }

    return { ok: true, sent, failed };
  } catch (err: unknown) {
    console.error("[deliverOrderByWhatsApp] Error:", err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      sent,
      failed,
    };
  }
}
