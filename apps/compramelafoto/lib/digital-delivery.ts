import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { createClientDownloadToken, getOrderDownloadTokens } from "@/lib/download-tokens";
import { createZipJob, getZipExpiresAt } from "@/lib/zip-job-queue";
import { resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";
import {
  orderNeedsDigitalDelivery,
  shouldEmailDownloadRightAway,
} from "@/lib/digital-download/order-needs-delivery";
import { resendDigitalDownloadEmailForOrder } from "@/lib/zip-job-notifications";

export type DigitalDeliveryResult = {
  /** Centro de descargas (experiencia principal). */
  downloadCenterUrl: string | null;
  /** Descarga ZIP vía API (opción secundaria). */
  downloadUrl: string | null;
  expiresAt: Date;
  /** True cuando el link se enviará por email una vez generado el ZIP (evita "Archivo no encontrado en R2"). */
  emailWhenReady?: boolean;
  isPreparing?: boolean;
};

export type DigitalDownloadStatus = {
  hasZipReady: boolean;
  token?: string;
};

/**
 * Prepara la entrega digital: crea token y encola el job de ZIP.
 * No envía email ni devuelve link aquí: el link se envía por email cuando el ZIP está listo (notifyClientDigitalZipReady).
 */
export async function ensureDigitalDelivery(orderId: number): Promise<DigitalDeliveryResult | null> {
  if (!Number.isFinite(orderId)) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      album: { select: { id: true, publicSlug: true } },
    },
  });

  if (!order) return null;

  const digitalPhotoCount = order.items.filter(
    (item) => item.productType === "DIGITAL"
  ).length;

  // Un pedido de sólo videos no tiene fotos digitales. Antes se cortaba acá y
  // el cliente pagaba sin recibir link ni mail; la regla está aparte y probada
  // en `order-needs-delivery` para que no vuelva a perderse.
  const videoCount = await prisma.videoOrderItem.count({ where: { orderId: order.id } });

  if (!orderNeedsDigitalDelivery({ digitalPhotoCount, videoCount })) return null;

  const existingTokens = await getOrderDownloadTokens(order.id);
  const existingDigital = existingTokens.find((t) => t.type === "CLIENT_DIGITAL");

  const config = await getAppConfig();
  const downloadDays = resolveDownloadLinkDays(config);
  const expiresAt = existingDigital?.expiresAt ?? new Date(Date.now() + downloadDays * 24 * 60 * 60 * 1000);

  if (!existingDigital) {
    await createClientDownloadToken({
      orderId: order.id,
      albumId: order.albumId,
      expiresAt,
    });
  }

  const photoIds = order.items
    .filter((item) => item.productType === "DIGITAL")
    .map((item) => item.photoId)
    .filter((id): id is number => Number.isFinite(id));

  if (photoIds.length > 0) {
    const existingJob = await prisma.zipGenerationJob.findFirst({
      where: {
        orderId: order.id,
        type: "ORDER_DOWNLOAD",
        status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existingJob) {
      await createZipJob({
        type: "ORDER_DOWNLOAD",
        orderId: order.id,
        albumId: order.albumId,
        photoIds,
        expiresAt: getZipExpiresAt(),
      });
    }
  }

  // Un pedido de sólo video no arma ningún ZIP, así que el correo que avisa
  // "tu descarga está lista" —que se dispara al terminar el ZIP— no saldría
  // nunca. Acá no hay nada que preparar: el link ya sirve, se avisa en el acto.
  // La clave fija evita que un segundo intento le mande dos correos.
  const emailAhora = shouldEmailDownloadRightAway({ digitalPhotoCount, videoCount });
  if (emailAhora) {
    try {
      await resendDigitalDownloadEmailForOrder(order.id, {
        idempotencyKey: `order-${order.id}-video-download`,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { digitalDeliveredAt: new Date() },
      });
    } catch (err: unknown) {
      // El correo no puede tumbar la entrega: el link ya está creado y el
      // cliente lo tiene en la pantalla de compra.
      console.error("[digital-delivery] aviso de pedido de sólo video", err);
    }
  }

  return {
    downloadCenterUrl: null,
    downloadUrl: null,
    expiresAt,
    emailWhenReady: !emailAhora,
  };
}

export async function getDigitalDownloadStatus(orderId: number): Promise<DigitalDownloadStatus | null> {
  if (!Number.isFinite(orderId)) return null;

  const tokens = await getOrderDownloadTokens(orderId);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  if (!clientToken) {
    return { hasZipReady: false };
  }

  const readyJob = await prisma.zipGenerationJob.findFirst({
    where: {
      orderId,
      type: "ORDER_DOWNLOAD",
      status: "COMPLETED",
      expiresAt: { gt: new Date() },
      OR: [{ r2Key: { not: null } }, { zipUrl: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    hasZipReady: Boolean(readyJob),
    token: clientToken.token,
  };
}
