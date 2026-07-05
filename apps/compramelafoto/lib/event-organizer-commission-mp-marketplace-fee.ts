import { baseFromTotal } from "@/lib/pricing/fee-formula";

const LOG_PREFIX = "[event-organizer-commission-payment]";

export type EventOrganizerCommissionMpEventInput = {
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
} | null;

/**
 * Mercado Pago marketplace (2-way split): el cobrador OAuth del fotógrafo recibe
 * total − marketplace_fee. La aplicación retiene marketplace_fee (fee plataforma + retención organizador).
 * Solo aplica comisión organizador de Evento (colaborativo), no comisión escolar de álbum.
 */
export function applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos(params: {
  orderId: number;
  albumId: number;
  eventId: number | null;
  totalPaidPesos: number;
  extensionSurchargePesos: number;
  platformPercent: number;
  /** Fee de plataforma que ya va a MP (ej. tras descuento por saldo referidos). ARS enteros. */
  marketplaceFeePlatformOnlyPesos: number;
  event: EventOrganizerCommissionMpEventInput;
}): {
  marketplaceFeePesos: number;
  photographerBasePesos: number;
  platformFeePesos: number;
  organizerCommissionPercentage: number | null;
  organizerCommissionAmountPesos: number;
  photographerNetPesos: number;
  amountToPlatformPesos: number;
  amountToPhotographerPesos: number;
  appliedOrganizerRetention: boolean;
} {
  const totalPaidPesos = Math.max(0, Math.round(Number(params.totalPaidPesos) || 0));
  const extensionPesos = Math.max(0, Math.round(Number(params.extensionSurchargePesos) || 0));
  const baseTotalPesos = Math.max(0, totalPaidPesos - extensionPesos);
  const platformFeePesos = Math.max(0, Math.round(Number(params.marketplaceFeePlatformOnlyPesos) || 0));

  const photographerBasePesos = baseFromTotal(baseTotalPesos, params.platformPercent);

  let organizerPct: number | null = null;
  let organizerCommissionAmountPesos = 0;
  let appliedOrganizerRetention = false;

  const ev = params.event;
  if (
    params.eventId != null &&
    ev?.organizerCommissionEnabled &&
    ev.organizerCommissionPercentage != null &&
    Number.isFinite(ev.organizerCommissionPercentage) &&
    ev.organizerCommissionPercentage > 0
  ) {
    const rawPct = ev.organizerCommissionPercentage;
    if (rawPct > 100 || rawPct < 0) {
      console.warn(LOG_PREFIX, "invalid_organizer_percent_skipped", {
        orderId: params.orderId,
        albumId: params.albumId,
        eventId: params.eventId,
        organizerCommissionPercentage: rawPct,
      });
    } else {
      organizerPct = rawPct;
      organizerCommissionAmountPesos = Math.round((photographerBasePesos * organizerPct) / 100);
      appliedOrganizerRetention = organizerCommissionAmountPesos > 0;
    }
  }

  const photographerNetPesos = Math.max(0, photographerBasePesos - organizerCommissionAmountPesos);
  const marketplaceFeePesos = platformFeePesos + organizerCommissionAmountPesos;
  const amountToPlatformPesos = marketplaceFeePesos;
  const amountToPhotographerPesos = Math.max(0, totalPaidPesos - marketplaceFeePesos);

  if (appliedOrganizerRetention) {
    console.info(LOG_PREFIX, {
      orderId: params.orderId,
      albumId: params.albumId,
      eventId: params.eventId,
      photographerBaseAmount: photographerBasePesos,
      platformFeeAmount: platformFeePesos,
      organizerCommissionPercentage: organizerPct,
      organizerCommissionAmount: organizerCommissionAmountPesos,
      photographerNetAmount: photographerNetPesos,
      amountToPlatform: amountToPlatformPesos,
      amountToPhotographer: amountToPhotographerPesos,
    });
  }

  return {
    marketplaceFeePesos,
    photographerBasePesos,
    platformFeePesos,
    organizerCommissionPercentage: organizerPct,
    organizerCommissionAmountPesos,
    photographerNetPesos,
    amountToPlatformPesos,
    amountToPhotographerPesos,
    appliedOrganizerRetention,
  };
}
