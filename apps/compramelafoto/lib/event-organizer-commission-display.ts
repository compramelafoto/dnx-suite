import type { Prisma } from "@/lib/prisma";

/** Desglose de una venta con comisión de organizador de evento (montos en pesos ARS). */
export type EventOrganizerSaleBreakdown = {
  active: true;
  eventId: number;
  eventTitle: string | null;
  organizerCommissionPercentage: number;
  totalPaidAmount: number;
  photographerBaseAmount: number;
  organizerCommissionAmount: number;
  platformFeeAmount: number;
  photographerNetAmount: number;
  /** true si los montos son estimados (pedido aún no PAID o sin snapshot). */
  isEstimate?: boolean;
};

export function decimalToDisplayPesos(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

export function formatCollaborativeEventMoneyPesos(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function mapEventOrganizerCommissionRowToBreakdown(row: {
  eventId: number;
  event?: { title: string } | null;
  organizerCommissionPercentage: number;
  photographerBaseAmount: Prisma.Decimal;
  organizerCommissionAmount: Prisma.Decimal;
  photographerNetAmount: Prisma.Decimal;
  totalPaidAmount: Prisma.Decimal;
  platformFeeAmount: Prisma.Decimal;
}): EventOrganizerSaleBreakdown {
  return {
    active: true,
    eventId: row.eventId,
    eventTitle: row.event?.title ?? null,
    organizerCommissionPercentage: row.organizerCommissionPercentage,
    totalPaidAmount: decimalToDisplayPesos(row.totalPaidAmount),
    photographerBaseAmount: decimalToDisplayPesos(row.photographerBaseAmount),
    organizerCommissionAmount: decimalToDisplayPesos(row.organizerCommissionAmount),
    platformFeeAmount: decimalToDisplayPesos(row.platformFeeAmount),
    photographerNetAmount: decimalToDisplayPesos(row.photographerNetAmount),
    isEstimate: false,
  };
}

/** Monto que debe sumarse en reportes del fotógrafo (neto si hay comisión de evento). */
export function photographerReportedAmountPesos(
  orderTotalPesos: number,
  breakdown: EventOrganizerSaleBreakdown | null | undefined
): number {
  if (breakdown?.active) return breakdown.photographerNetAmount;
  return orderTotalPesos;
}
