import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[referral]";

export const REFERRAL_SKIP_REASON_EVENT_ORGANIZER =
  "referral skipped because referrer is event organizer receiving organizer commission";

export function parseAlbumOrderIdFromPrintOrderTags(tags: string[]): number | null {
  for (const tag of tags) {
    const match = String(tag).match(/^ALBUM_ORDER:(\d+)$/);
    if (!match) continue;
    const orderId = Number(match[1]);
    if (Number.isInteger(orderId) && orderId > 0) return orderId;
  }
  return null;
}

export async function resolveAlbumEventIdFromPrintOrderTags(
  tags: string[]
): Promise<number | null | undefined> {
  const albumOrderId = parseAlbumOrderIdFromPrintOrderTags(tags);
  if (albumOrderId == null) return undefined;

  const albumOrder = await prisma.order.findUnique({
    where: { id: albumOrderId },
    select: { album: { select: { eventId: true } } },
  });
  return albumOrder?.album?.eventId ?? null;
}

/**
 * Evita doble beneficio: organizador de evento con comisión activa no acumula ReferralEarning
 * sobre ventas de fotógrafos en álbumes de ese evento que él refirió.
 */
export async function shouldSkipReferralEarningForEventOrganizer(params: {
  referrerUserId: number;
  albumEventId: number | null | undefined;
  context?: { orderId?: number; orderType?: string; saleRef?: string };
}): Promise<boolean> {
  const eventId = params.albumEventId;
  if (eventId == null) return false;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      creatorId: true,
      organizerCommissionEnabled: true,
    },
  });

  if (!event?.organizerCommissionEnabled || event.creatorId !== params.referrerUserId) {
    return false;
  }

  console.warn(LOG_PREFIX, "referral_skipped_event_organizer_commission", {
    reason: REFERRAL_SKIP_REASON_EVENT_ORGANIZER,
    referrerUserId: params.referrerUserId,
    eventId: event.id,
    eventCreatorId: event.creatorId,
    ...params.context,
  });
  return true;
}
