import "server-only";
import { prisma } from "@repo/db";
import { recordCollectionFees, recordPartialRefund, reverseCollection } from "@/lib/cash/collection";
import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";
import { ACTIVE_BOOKING_STATUSES } from "./constants";

/**
 * Lo que pasa con una reserva después de cobrada por Mercado Pago: comisiones en Caja y
 * devolución o contracargo.
 */

export async function syncPaidBookingFees(bookingId: string, facts: MpPaymentFacts): Promise<void> {
  const reserva = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { workspaceId: true, mpPaymentId: true },
  });
  if (!reserva || reserva.mpPaymentId !== facts.id) return;
  await prisma.$transaction(async (tx) => {
    await recordCollectionFees(tx, {
      workspaceId: reserva.workspaceId,
      sourceModule: "bookings",
      sourceRef: bookingId,
      mpFeeMinor: facts.mpFeeMinor,
      platformFeeMinor: facts.platformFeeMinor,
    });
    if (facts.refundedMinor > 0 && facts.status === "approved") {
      await recordPartialRefund(tx, {
        workspaceId: reserva.workspaceId,
        sourceModule: "bookings",
        sourceRef: bookingId,
        refundedMinor: facts.refundedMinor,
        occurredAt: facts.lastUpdatedAt ?? new Date(),
      });
    }
  });
}

/**
 * El pago de la reserva se devolvió o se desconoció: la reserva se cancela (libera el horario),
 * queda marcada como reembolsada y se anula en Caja.
 */
export async function refundBooking(bookingId: string, facts: MpPaymentFacts): Promise<{ applied: boolean }> {
  const reserva = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, workspaceId: true, status: true, paymentStatus: true, mpPaymentId: true },
  });
  if (!reserva || reserva.mpPaymentId !== facts.id) return { applied: false };

  const motivo =
    facts.status === "charged_back"
      ? "El cliente desconoció el pago (contracargo)"
      : "Mercado Pago devolvió el pago";

  let applied = false;
  await prisma.$transaction(async (tx) => {
    if (reserva.paymentStatus === "PAID") {
      const activa = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(reserva.status);
      await tx.booking.update({
        where: { id: reserva.id },
        data: activa
          ? {
              paymentStatus: "REFUNDED",
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: motivo,
              holdExpiresAt: null,
            }
          : { paymentStatus: "REFUNDED" },
      });
      applied = true;
    }
    const r = await reverseCollection(tx, {
      workspaceId: reserva.workspaceId,
      sourceModule: "bookings",
      sourceRef: reserva.id,
      reason: motivo,
      occurredAt: facts.lastUpdatedAt ?? new Date(),
    });
    if (r.reversed > 0) applied = true;
  });
  return { applied };
}
