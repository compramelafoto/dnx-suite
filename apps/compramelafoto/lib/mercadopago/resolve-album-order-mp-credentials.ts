import { prisma } from "@/lib/prisma";
import {
  resolveEventPaymentCollectorFromData,
  type ResolvedEventPaymentCollector,
} from "@/lib/events/resolve-event-payment-collector";

export type { ResolvedEventPaymentCollector };

/** CLF-ORGANIZER-AS-COLLECTOR-100 — resuelve cobrador MP para un evento + fotógrafo del álbum. */
export async function resolveEventPaymentCollector(params: {
  eventId: number | null | undefined;
  photographerUserId: number | null;
}): Promise<ResolvedEventPaymentCollector> {
  return resolveAlbumOrderMercadoPagoCredentials(params);
}

export async function resolveAlbumOrderMercadoPagoCredentials(params: {
  photographerUserId: number | null;
  eventId: number | null | undefined;
}): Promise<ResolvedEventPaymentCollector> {
  const event =
    params.eventId != null
      ? await prisma.event.findUnique({
          where: { id: params.eventId },
          select: {
            id: true,
            creatorId: true,
            organizerCommissionEnabled: true,
            organizerCommissionPercentage: true,
          },
        })
      : null;

  let photographerMpAccessToken: string | null | undefined;
  if (params.photographerUserId != null) {
    const photographer = await prisma.user.findUnique({
      where: { id: params.photographerUserId },
      select: { mpAccessToken: true },
    });
    photographerMpAccessToken = photographer?.mpAccessToken;
  }

  let organizerMpAccessToken: string | null | undefined;
  let organizerMpUserId: string | null | undefined;
  if (event != null) {
    const organizer = await prisma.user.findUnique({
      where: { id: event.creatorId },
      select: { mpAccessToken: true, mpUserId: true },
    });
    organizerMpAccessToken = organizer?.mpAccessToken;
    organizerMpUserId = organizer?.mpUserId;
  }

  return resolveEventPaymentCollectorFromData({
    event,
    photographerUserId: params.photographerUserId,
    photographerMpAccessToken,
    organizerMpAccessToken,
    organizerMpUserId,
  });
}

/** Token OAuth del cobrador MP para un pedido de álbum (webhook, confirm, finalize). */
export async function resolveAlbumOrderMpAccessTokenByOrderId(
  orderId: number
): Promise<string | undefined> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      album: { select: { userId: true, eventId: true } },
    },
  });
  if (!order?.album) return undefined;

  const creds = await resolveAlbumOrderMercadoPagoCredentials({
    photographerUserId: order.album.userId,
    eventId: order.album.eventId,
  });
  return creds.ok ? creds.accessToken : undefined;
}
