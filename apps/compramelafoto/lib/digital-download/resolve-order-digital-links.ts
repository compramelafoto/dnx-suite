import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import {
  resolveClientDigitalDownloadLinks,
  type ClientDigitalDownloadLinks,
} from "@/lib/digital-download/download-center-rollout";

export type OrderDigitalDownloadLinks = ClientDigitalDownloadLinks & {
  digitalPhotoCount: number;
};

export async function resolveOrderDigitalDownloadLinks(
  orderId: number,
  baseUrl: string,
  context: string
): Promise<OrderDigitalDownloadLinks | null> {
  if (!Number.isFinite(orderId)) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
      status: true,
      items: {
        where: { productType: "DIGITAL" },
        select: { photoId: true },
      },
    },
  });

  if (!order || order.status !== "PAID" || order.items.length === 0) {
    return null;
  }

  const seenPhotoIds = new Set<number>();
  for (const item of order.items) {
    if (Number.isFinite(item.photoId)) seenPhotoIds.add(Number(item.photoId));
  }
  const digitalPhotoCount = seenPhotoIds.size;

  let accessToken = await getOrderDownloadCenterAccessToken(orderId);
  if (!accessToken) {
    await ensureDigitalDelivery(orderId);
    accessToken = await getOrderDownloadCenterAccessToken(orderId);
  }
  if (!accessToken) return null;

  const links = resolveClientDigitalDownloadLinks({
    orderId: order.id,
    orderCreatedAt: order.createdAt,
    accessToken,
    baseUrl,
    context,
  });

  return {
    ...links,
    digitalPhotoCount,
  };
}
