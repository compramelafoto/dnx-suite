/**
 * CLF-ORGANIZER-AS-COLLECTOR-100 — clasificación contable de comisiones de organizador.
 * Separa cobro directo MP (100% collector) del flujo retenido/retiro manual.
 */
import {
  EventOrganizerCommissionPayoutMode,
  EventOrganizerCommissionStatus,
  type Prisma,
} from "@prisma/client";

export type OrganizerCommissionLedgerRow = {
  status: EventOrganizerCommissionStatus;
  payoutMode: EventOrganizerCommissionPayoutMode;
};

/** Estado y modo para ventas cobradas directamente por el organizador en MP. */
export const ORGANIZER_DIRECT_MP_COMMISSION_STATUS =
  EventOrganizerCommissionStatus.PAID_DIRECT_TO_ORGANIZER;

export const ORGANIZER_DIRECT_MP_COMMISSION_PAYOUT_MODE =
  EventOrganizerCommissionPayoutMode.ORGANIZER_AS_COLLECTOR;

export type OrganizerCommissionCollectionType = "PLATFORM_HELD" | "DIRECT_MP";

export function resolveOrganizerCommissionCollectionType(
  row: OrganizerCommissionLedgerRow
): OrganizerCommissionCollectionType {
  return isOrganizerDirectMpCollectionCommission(row) ? "DIRECT_MP" : "PLATFORM_HELD";
}

export function isOrganizerDirectMpCollectionCommission(
  row: OrganizerCommissionLedgerRow
): boolean {
  return (
    row.status === ORGANIZER_DIRECT_MP_COMMISSION_STATUS ||
    row.payoutMode === ORGANIZER_DIRECT_MP_COMMISSION_PAYOUT_MODE
  );
}

/** Comisión retenida por plataforma (<100% o liquidación manual). */
export function isPlatformHeldOrganizerCommission(row: OrganizerCommissionLedgerRow): boolean {
  return (
    !isOrganizerDirectMpCollectionCommission(row) &&
    row.payoutMode === EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM
  );
}

/** Suma al saldo retirable del organizador (panel de retiros). */
export function countsTowardOrganizerWithdrawalBalance(row: OrganizerCommissionLedgerRow): boolean {
  if (isOrganizerDirectMpCollectionCommission(row)) return false;
  return (
    row.status === EventOrganizerCommissionStatus.PENDING ||
    row.status === EventOrganizerCommissionStatus.AVAILABLE ||
    row.status === EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED
  );
}

/** Liquidada por transferencia manual de la plataforma (post-retiro). */
export function isPlatformWithdrawalPaidCommission(row: OrganizerCommissionLedgerRow): boolean {
  return (
    row.status === EventOrganizerCommissionStatus.PAID &&
    row.payoutMode === EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM
  );
}

export function organizerDirectMpCollectionCommissionFields(paymentConfirmedAt: Date): {
  status: typeof ORGANIZER_DIRECT_MP_COMMISSION_STATUS;
  payoutMode: typeof ORGANIZER_DIRECT_MP_COMMISSION_PAYOUT_MODE;
  availableAt: Date;
  paidAt: Date;
} {
  return {
    status: ORGANIZER_DIRECT_MP_COMMISSION_STATUS,
    payoutMode: ORGANIZER_DIRECT_MP_COMMISSION_PAYOUT_MODE,
    availableAt: paymentConfirmedAt,
    paidAt: paymentConfirmedAt,
  };
}

/** Filtro Prisma: solo comisiones elegibles para retiro manual. */
export const PLATFORM_HELD_WITHDRAWAL_PIPELINE_WHERE: Prisma.EventOrganizerCommissionWhereInput =
  {
    payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
    status: {
      in: [
        EventOrganizerCommissionStatus.PENDING,
        EventOrganizerCommissionStatus.AVAILABLE,
        EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
        EventOrganizerCommissionStatus.PAID,
      ],
    },
  };

export const ORGANIZER_DIRECT_MP_COLLECTION_WHERE: Prisma.EventOrganizerCommissionWhereInput = {
  payoutMode: ORGANIZER_DIRECT_MP_COMMISSION_PAYOUT_MODE,
  status: ORGANIZER_DIRECT_MP_COMMISSION_STATUS,
};

export const ORGANIZER_COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En espera",
  AVAILABLE: "Disponible",
  WITHDRAWAL_REQUESTED: "Retiro solicitado",
  PAID: "Liquidado por plataforma",
  PAID_DIRECT_TO_ORGANIZER: "Cobrado en tu Mercado Pago",
  CANCELLED: "Cancelado",
};

export const ORGANIZER_COMMISSION_COLLECTION_LABELS: Record<OrganizerCommissionCollectionType, string> =
  {
    PLATFORM_HELD: "Retenido por plataforma",
    DIRECT_MP: "Cobro directo Mercado Pago",
  };
