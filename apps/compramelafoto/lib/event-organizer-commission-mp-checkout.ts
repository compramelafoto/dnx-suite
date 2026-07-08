import { prisma } from "@/lib/prisma";
import type { PaymentCollectorType } from "@/lib/events/resolve-event-payment-collector";
import {
  applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos,
  validateEventOrganizerCommissionMpSplit,
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

export type AlbumOrderMercadoPagoCheckoutSplit = {
  marketplaceFeePesos: number;
  amountToCollectorPesos: number;
  organizerAsCollector: boolean;
};

/** marketplace_fee MP según collector (fotógrafo u organizador al 100%). */
export async function buildAlbumOrderMercadoPagoCheckoutSplit(params: {
  orderId: number;
  albumId: number;
  eventId: number | null | undefined;
  totalPaidPesos: number;
  extensionSurchargePesos?: number;
  platformPercent: number;
  marketplaceFeePlatformOnlyPesos: number;
  paymentCollectorType?: PaymentCollectorType;
}): Promise<AlbumOrderMercadoPagoCheckoutSplit> {
  const event = await loadEventOrganizerCommissionMpEventInput(params.eventId);
  const organizerAsCollector = params.paymentCollectorType === "ORGANIZER";

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
    paymentCollectorType: params.paymentCollectorType,
  });

  const hasOrganizerCommission =
    split.appliedOrganizerRetention || organizerAsCollector;

  if (hasOrganizerCommission || organizerAsCollector) {
    const mpValidation = validateEventOrganizerCommissionMpSplit({
      totalPaidPesos: params.totalPaidPesos,
      marketplaceFeePesos: split.marketplaceFeePesos,
      amountToCollectorPesos: split.amountToCollectorPesos,
    });
    if (!mpValidation.valid) {
      throw new Error(mpValidation.error);
    }
  }

  return {
    marketplaceFeePesos: split.marketplaceFeePesos,
    amountToCollectorPesos: split.amountToCollectorPesos,
    organizerAsCollector,
  };
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
  paymentCollectorType?: PaymentCollectorType;
}): Promise<number> {
  const result = await buildAlbumOrderMercadoPagoCheckoutSplit(params);
  return result.marketplaceFeePesos;
}
