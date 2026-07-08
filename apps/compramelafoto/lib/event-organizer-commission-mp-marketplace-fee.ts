import { baseFromTotal } from "@/lib/pricing/fee-formula";
import type { PaymentCollectorType } from "@/lib/events/resolve-event-payment-collector";

const LOG_PREFIX = "[event-organizer-commission-payment]";

/** CLF-ORGANIZER-COMMISSION-100 — mensaje cuando el split automático MP no cierra. */
export const EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR =
  "Esta comisión no puede aplicarse automáticamente porque deja importes inválidos para la distribución del pago. Ajustá la comisión o usá liquidación manual.";

export type EventOrganizerCommissionMpSplitValidation = {
  valid: boolean;
  error?: string;
};

/**
 * En eventos con organizador collector al 100%, el neto del collector OAuth puede ser el organizador,
 * no necesariamente el fotógrafo.
 */
export const MP_COLLECTOR_NET_AMOUNT_NOTE =
  "En eventos con organizador collector al 100%, este valor representa el neto del collector OAuth, que puede ser el organizador, no necesariamente el fotógrafo.";

/** Valida montos del split MP (2 vías: cobrador OAuth + marketplace_fee). */
export function validateEventOrganizerCommissionMpSplit(params: {
  totalPaidPesos: number;
  marketplaceFeePesos: number;
  /** Neto que recibe el cobrador OAuth (fotógrafo u organizador). */
  amountToCollectorPesos?: number;
  /** @deprecated Usar amountToCollectorPesos. */
  amountToPhotographerPesos?: number;
}): EventOrganizerCommissionMpSplitValidation {
  const total = Math.round(Number(params.totalPaidPesos));
  const marketplaceFee = Math.round(Number(params.marketplaceFeePesos));
  const toCollector = Math.round(
    Number(params.amountToCollectorPesos ?? params.amountToPhotographerPesos)
  );

  if (!Number.isFinite(total) || total <= 0) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (!Number.isFinite(marketplaceFee) || marketplaceFee < 0) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (!Number.isFinite(toCollector) || toCollector < 0) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (toCollector <= 0) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (marketplaceFee >= total) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (marketplaceFee > total) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  if (marketplaceFee + toCollector !== total) {
    return { valid: false, error: EVENT_ORGANIZER_COMMISSION_AUTOMATIC_PAYOUT_ERROR };
  }
  return { valid: true };
}

export type EventOrganizerCommissionMpEventInput = {
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
} | null;

/**
 * Mercado Pago marketplace (2-way split): el cobrador OAuth recibe total − marketplace_fee.
 * - Fotógrafo collector (<100%): marketplace_fee = fee plataforma + retención organizador.
 * - Organizador collector (100%): marketplace_fee = solo fee plataforma; organizador cobra el neto.
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
  paymentCollectorType?: PaymentCollectorType;
}): {
  marketplaceFeePesos: number;
  photographerBasePesos: number;
  platformFeePesos: number;
  organizerCommissionPercentage: number | null;
  organizerCommissionAmountPesos: number;
  photographerNetPesos: number;
  amountToPlatformPesos: number;
  /** Neto MP del cobrador OAuth. Ver {@link MP_COLLECTOR_NET_AMOUNT_NOTE}. */
  amountToCollectorPesos: number;
  /** @deprecated Alias de amountToCollectorPesos. Ver {@link MP_COLLECTOR_NET_AMOUNT_NOTE}. */
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
      organizerCommissionAmountPesos = Math.min(
        photographerBasePesos,
        Math.round((photographerBasePesos * organizerPct) / 100)
      );
      appliedOrganizerRetention = organizerCommissionAmountPesos > 0;
    }
  }

  const photographerNetPesos = Math.max(0, photographerBasePesos - organizerCommissionAmountPesos);

  const organizerAsCollector = params.paymentCollectorType === "ORGANIZER";
  const marketplaceFeePesos = organizerAsCollector
    ? Math.max(0, platformFeePesos)
    : Math.max(0, platformFeePesos + organizerCommissionAmountPesos);
  const amountToPlatformPesos = marketplaceFeePesos;
  const amountToCollectorPesos = Math.max(0, totalPaidPesos - marketplaceFeePesos);

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
      amountToCollector: amountToCollectorPesos,
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
    amountToCollectorPesos,
    amountToPhotographerPesos: amountToCollectorPesos,
    appliedOrganizerRetention,
  };
}
