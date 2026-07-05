import { prisma } from "@/lib/prisma";
import {
  applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos,
  type EventOrganizerCommissionMpEventInput,
} from "@/lib/event-organizer-commission-mp-marketplace-fee";

export async function loadEventOrganizerCommissionMpEventInput(
  eventId: number | null | undefined
): Promise<EventOrganizerCommissionMpEventInput> {
  if (eventId == null) return null;
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: true,
    },
  });
}

/** marketplace_fee MP = fee plataforma efectivo (post-descuento referido) + retención organizador evento. */
export async function buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer(params: {
  orderId: number;
  albumId: number;
  eventId: number | null | undefined;
  totalPaidPesos: number;
  extensionSurchargePesos?: number;
  platformPercent: number;
  marketplaceFeePlatformOnlyPesos: number;
}): Promise<number> {
  const event = await loadEventOrganizerCommissionMpEventInput(params.eventId);
  const split = applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos({
    orderId: params.orderId,
    albumId: params.albumId,
    eventId: params.eventId ?? null,
    totalPaidPesos: params.totalPaidPesos,
    extensionSurchargePesos: Math.max(0, Math.round(Number(params.extensionSurchargePesos) || 0)),
    platformPercent: params.platformPercent,
    marketplaceFeePlatformOnlyPesos: Math.max(
      0,
      Math.round(Number(params.marketplaceFeePlatformOnlyPesos) || 0)
    ),
    event,
  });
  return split.marketplaceFeePesos;
}
