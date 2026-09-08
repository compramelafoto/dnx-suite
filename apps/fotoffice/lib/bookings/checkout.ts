import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { appUrl } from "@/lib/app-url";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { feeForBooking } from "@/lib/platform-fee/ledger-booking";
import { pendingFeeDebtMinor, recordDischarge } from "@/lib/platform-fee/ledger";
import { BOOKINGS_MODULE_KEY } from "./constants";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { BOOKINGS_TIME_ZONE } from "./time";

/**
 * Cobro de una reserva. Es el MISMO circuito que las cuotas: Checkout Pro con el token de
 * la institución y `marketplace_fee` retenido en la misma operación. El dinero no pasa por
 * DNX en ningún momento.
 *
 * ── Por qué un webhook propio y no el de cuotas ──
 *
 * El webhook de cuotas (`/api/payments/mp/webhook`) busca el pago entre los
 * `MembershipPayment` pendientes. Enseñarle a distinguir dos dominios lo volvería el punto
 * donde un error en reservas puede romper el cobro de las cuotas, que ya funciona en
 * producción. Un webhook aparte cuesta un archivo y no toca nada de lo que anda.
 */

export const BOOKING_EXTERNAL_REFERENCE_PREFIX = "booking:";

export function bookingExternalReference(bookingId: string): string {
  return `${BOOKING_EXTERNAL_REFERENCE_PREFIX}${bookingId}`;
}

/**
 * El identificador de reserva que viaja en un aviso de Mercado Pago, o null.
 *
 * El prefijo NO es decorativo: las cuotas mandan el id pelado, y sin él este webhook
 * acreditaría un pago de cuota contra una reserva que no existe.
 */
export function parseBookingExternalReference(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith(BOOKING_EXTERNAL_REFERENCE_PREFIX)) return null;
  const id = raw.slice(BOOKING_EXTERNAL_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export type CheckoutResult = { ok: true; checkoutUrl: string } | { ok: false; error: string };

export async function startBookingCheckout(input: {
  workspaceId: string;
  bookingId: string;
  payerEmail: string;
  /** A dónde vuelve la persona después de pagar. Path interno. */
  returnPath: string;
}): Promise<CheckoutResult> {
  const reserva = await prisma.booking.findFirst({
    where: { id: input.bookingId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalArs: true,
      startAt: true,
      space: { select: { name: true } },
    },
  });
  if (!reserva) return { ok: false, error: "No encontramos esa reserva." };
  if (reserva.status !== "HOLD") return { ok: false, error: "Esa reserva no está esperando el pago." };
  if (reserva.paymentStatus === "PAID") return { ok: false, error: "Esa reserva ya está paga." };

  const totalMinor = decimalArsToMinor(reserva.totalArs);
  if (totalMinor <= 0) return { ok: false, error: "Esa reserva no tiene nada que pagar." };

  const base = appUrl();
  if (!base) return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };

  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) {
    // El mensaje habla de la institución, no de quien reserva: no puede resolverlo.
    return {
      ok: false,
      error: "La institución todavía no tiene los cobros habilitados. Escribile a la Secretaría.",
    };
  }

  const feeBps = await getPlatformFeeBps(input.workspaceId, BOOKINGS_MODULE_KEY);
  const deuda = await pendingFeeDebtMinor(input.workspaceId);
  const reparto = feeForBooking({ totalMinor, feeBps, pendingDebtMinor: deuda });

  // El fee se congela ANTES de ir a Mercado Pago: lo que se retuvo tiene que quedar escrito
  // aunque después cambie la configuración del workspace.
  await prisma.booking.update({
    where: { id: reserva.id },
    data: { feeBps, feeArs: minorToDecimalString(reparto.withholdMinor) },
  });

  const fecha = reserva.startAt.toLocaleDateString("es-AR", { timeZone: BOOKINGS_TIME_ZONE });

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: totalMinor,
      currency: "ARS",
      description: `${reserva.space.name} — ${fecha}`,
      externalReference: bookingExternalReference(reserva.id),
      idempotencyKey: randomUUID(),
      successUrl: `${base}${input.returnPath}?pago=ok`,
      pendingUrl: `${base}${input.returnPath}?pago=pendiente`,
      failureUrl: `${base}${input.returnPath}?pago=error`,
      notificationUrl: `${base}/api/payments/mp/reservas-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: reparto.withholdMinor,
      itemId: `reserva-${reserva.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { bookingId: reserva.id, workspaceId: input.workspaceId },
      payerEmail: input.payerEmail,
    });

    await prisma.booking.update({
      where: { id: reserva.id },
      data: { mpPreferenceId: preferencia.providerPreferenceId },
    });

    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][reservas] MercadoPago rechazó la preferencia", {
      bookingId: reserva.id,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}

/**
 * Acredita un pago de reserva. **Idempotente**: un aviso repetido no acredita dos veces ni
 * escribe dos asientos en el libro de comisiones.
 */
export async function creditBookingPayment(input: {
  bookingId: string;
  providerPaymentId: string;
}): Promise<{ applied: boolean; motivo?: string }> {
  return prisma.$transaction(async (tx) => {
    const reserva = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        paymentStatus: true,
        totalArs: true,
        feeArs: true,
        feeBps: true,
      },
    });
    if (!reserva) return { applied: false, motivo: "la reserva no existe" };
    if (reserva.paymentStatus === "PAID") return { applied: false, motivo: "aviso repetido" };
    if (reserva.status === "CANCELLED" || reserva.status === "EXPIRED") {
      // El horario ya se liberó. No se revive la reserva: otra persona pudo haberlo tomado.
      return { applied: false, motivo: "la reserva ya no está activa" };
    }

    await tx.booking.update({
      where: { id: reserva.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        mpPaymentId: input.providerPaymentId,
        paidAt: new Date(),
        holdExpiresAt: null,
      },
    });

    // La comisión ya la retuvo Mercado Pago en la operación. El asiento negativo del libro
    // es lo que cancela la deuda arrastrada que venía incluida en esa retención.
    //
    // Se descuenta la comisión PROPIA usando el `feeBps` congelado en la fila, no el 5% de
    // memoria: si el workspace tiene otra comisión configurada, restar 500 dejaría deuda
    // cobrada sin asentar —o asentaría de más—.
    const retenido = decimalArsToMinor(reserva.feeArs);
    const propioMinor = splitMinorByPlatformFee(
      decimalArsToMinor(reserva.totalArs),
      reserva.feeBps,
    ).feeMinor;
    const aDeuda = Math.max(0, retenido - propioMinor);
    if (aDeuda > 0) {
      await recordDischarge(tx, {
        workspaceId: reserva.workspaceId,
        bookingId: reserva.id,
        amountMinor: aDeuda,
        note: `Deuda cobrada en la reserva ${reserva.id}`,
      });
    }

    return { applied: true };
  });
}
