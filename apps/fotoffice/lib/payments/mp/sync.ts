import "server-only";
import { prisma } from "@repo/db";
import { creditBookingPayment, parseBookingExternalReference } from "@/lib/bookings/checkout";
import { refundBooking, syncPaidBookingFees } from "@/lib/bookings/mp-settlement";
import { recordCollectionFees, recordPartialRefund } from "@/lib/cash/collection";
import { creditMembershipPayment } from "@/lib/membership/credit-payment";
import { parseCourseExternalReference } from "@/lib/presential-courses/checkout";
import { depositCoursePayment, refundCourseEnrollment } from "@/lib/presential-courses/cash";
import { approveCourseEnrollment } from "@/lib/presential-courses/enrollment-workflow";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { creditStorePayment } from "@/lib/store/credit-payment";
import { parseStoreExternalReference } from "@/lib/store/external-reference";
import { recordStoreOrderFees, refundStoreOrder } from "@/lib/store/mp-settlement";
import { collectionDate, isFullyReversed, type MpPaymentFacts } from "./payment-facts";

/**
 * Aplicar lo que Mercado Pago dice de un pago, sea de lo que sea.
 *
 * Es el único camino: lo usan los cuatro webhooks, la revisión diaria y la corrección de lo
 * histórico. Cada rama es idempotente, así que pasar dos veces por el mismo pago no cambia
 * nada; pasar después de una devolución la aplica.
 *
 * La referencia externa dice de qué módulo es el pago: `booking:`, `curso:`/…, `store:`, o el
 * id pelado de una intención de pago de cuotas.
 */

export type SyncOutcome = {
  module: "membership" | "bookings" | "courses" | "store" | "unknown";
  action: string;
};

const ESPERA = new Set(["pending", "in_process", "in_mediation", "authorized"]);

export async function syncMpPayment(workspaceId: string, facts: MpPaymentFacts): Promise<SyncOutcome> {
  const ref = facts.externalReference;
  if (!ref) return { module: "unknown", action: "pago sin referencia" };

  const bookingId = parseBookingExternalReference(ref);
  if (bookingId) return syncBooking(workspaceId, bookingId, facts);

  const enrollmentId = parseCourseExternalReference(ref);
  if (enrollmentId) return syncCourse(workspaceId, enrollmentId, facts);

  const orderId = parseStoreExternalReference(ref);
  if (orderId) return syncStore(workspaceId, orderId, facts);

  return syncMembership(workspaceId, ref, facts);
}

async function syncMembership(workspaceId: string, paymentId: string, facts: MpPaymentFacts): Promise<SyncOutcome> {
  const intento = await prisma.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { id: true, workspaceId: true, status: true, providerPaymentRef: true },
  });
  if (!intento || intento.workspaceId !== workspaceId) return { module: "unknown", action: "referencia desconocida" };
  // Una intención ya acreditada con OTRO pago no se toca con este: sería un segundo pago.
  if (intento.providerPaymentRef && intento.providerPaymentRef !== facts.id && intento.status === "ACREDITADO") {
    return { module: "membership", action: "otro pago de la misma intención: revisar" };
  }

  const r = await creditMembershipPayment({
    paymentId: intento.id,
    providerPaymentRef: facts.id,
    providerStatus: facts.status,
    paidAmountMinor: facts.grossMinor,
    paidAt: collectionDate(facts, new Date()),
    mpFeeMinor: facts.mpFeeMinor,
    platformFeeMinor: facts.platformFeeMinor,
  });

  // Ya acreditado antes: se completan las comisiones (si faltaban) y las devoluciones parciales.
  if (facts.status === "approved" && intento.status === "ACREDITADO") {
    await prisma.$transaction(async (tx) => {
      await recordCollectionFees(tx, {
        workspaceId,
        sourceModule: "membership",
        sourceRef: intento.id,
        mpFeeMinor: facts.mpFeeMinor,
        platformFeeMinor: facts.platformFeeMinor,
      });
      if (facts.refundedMinor > 0) {
        await recordPartialRefund(tx, {
          workspaceId,
          sourceModule: "membership",
          sourceRef: intento.id,
          refundedMinor: facts.refundedMinor,
          occurredAt: facts.lastUpdatedAt ?? new Date(),
        });
      }
    });
  }
  return { module: "membership", action: r.ok ? r.motivo : `error: ${r.motivo}` };
}

async function syncBooking(workspaceId: string, bookingId: string, facts: MpPaymentFacts): Promise<SyncOutcome> {
  const reserva = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { workspaceId: true, paymentStatus: true },
  });
  if (!reserva || reserva.workspaceId !== workspaceId) return { module: "unknown", action: "referencia desconocida" };

  if (isFullyReversed(facts)) {
    const r = await refundBooking(bookingId, facts);
    return { module: "bookings", action: r.applied ? "reserva reembolsada" : "sin cambios" };
  }
  if (facts.status !== "approved") return { module: "bookings", action: `estado ${facts.status}` };

  if (reserva.paymentStatus !== "PAID") {
    const r = await creditBookingPayment({
      bookingId,
      providerPaymentId: facts.id,
      paidAmountMinor: facts.grossMinor,
      paidAt: collectionDate(facts, new Date()),
      mpFeeMinor: facts.mpFeeMinor,
      platformFeeMinor: facts.platformFeeMinor,
    });
    return { module: "bookings", action: r.motivo ?? (r.applied ? "acreditada" : "sin cambios") };
  }
  await syncPaidBookingFees(bookingId, facts);
  return { module: "bookings", action: "comisiones al día" };
}

async function syncCourse(workspaceId: string, enrollmentId: string, facts: MpPaymentFacts): Promise<SyncOutcome> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { workspaceId: true, paymentStatus: true, paymentRef: true },
  });
  if (!inscripcion || inscripcion.workspaceId !== workspaceId) {
    return { module: "unknown", action: "referencia desconocida" };
  }

  if (isFullyReversed(facts)) {
    const r = await refundCourseEnrollment({
      enrollmentId,
      reason:
        facts.status === "charged_back"
          ? "El alumno desconoció el pago (contracargo)"
          : "Mercado Pago devolvió el pago",
      at: facts.lastUpdatedAt ?? new Date(),
    });
    return { module: "courses", action: r.applied ? "inscripción reembolsada" : "sin cambios" };
  }

  if (facts.status === "rejected" || facts.status === "cancelled") {
    await prisma.courseEnrollment.updateMany({
      where: { id: enrollmentId, paymentStatus: "PENDING" },
      data: { paymentStatus: facts.status === "rejected" ? "REJECTED" : "CANCELLED", paymentRef: facts.id },
    });
    logCourseEvent("payment_not_approved", { enrollmentId, providerPaymentId: facts.id, estado: facts.status });
    return { module: "courses", action: `estado ${facts.status}` };
  }
  if (ESPERA.has(facts.status) || facts.status !== "approved") {
    return { module: "courses", action: `estado ${facts.status}` };
  }

  if (inscripcion.paymentStatus === "PENDING") {
    const r = await approveCourseEnrollment({
      enrollmentId,
      paymentRef: facts.id,
      amountArs: facts.grossMinor > 0 ? facts.grossMinor / 100 : undefined,
      paymentMethodId: facts.paymentMethodId,
    });
    if (!r.ok) return { module: "courses", action: `no aprobada: ${r.reason}` };
  } else if (inscripcion.paymentStatus !== "APPROVED" || inscripcion.paymentRef !== facts.id) {
    return { module: "courses", action: "inscripción con otro estado o pago" };
  }

  const d = await depositCoursePayment({
    enrollmentId,
    paidAt: collectionDate(facts, new Date()),
    mpFeeMinor: facts.mpFeeMinor,
    platformFeeMinor: facts.platformFeeMinor,
  });
  if (facts.refundedMinor > 0) {
    await prisma.$transaction((tx) =>
      recordPartialRefund(tx, {
        workspaceId,
        sourceModule: "courses",
        sourceRef: enrollmentId,
        refundedMinor: facts.refundedMinor,
        occurredAt: facts.lastUpdatedAt ?? new Date(),
      }),
    );
  }
  return { module: "courses", action: d.deposited ? "aprobada y en Caja" : "aprobada" };
}

async function syncStore(workspaceId: string, orderId: string, facts: MpPaymentFacts): Promise<SyncOutcome> {
  const pedido = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    select: { workspaceId: true },
  });
  if (!pedido || pedido.workspaceId !== workspaceId) return { module: "unknown", action: "referencia desconocida" };

  if (isFullyReversed(facts)) {
    const r = await refundStoreOrder(orderId, facts);
    return { module: "store", action: r.applied ? "pedido reembolsado" : "sin cambios" };
  }
  if (facts.status !== "approved") return { module: "store", action: `estado ${facts.status}` };

  const r = await creditStorePayment({
    orderId,
    providerPaymentId: facts.id,
    amountMinor: facts.grossMinor,
    currency: "ARS",
    paidAt: facts.approvedAt,
  });
  await recordStoreOrderFees(orderId, facts);
  return { module: "store", action: r.motivo ?? (r.applied ? "acreditado" : "sin cambios") };
}
