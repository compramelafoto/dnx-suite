import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { recordAccrual } from "@/lib/platform-fee/ledger";
import { ACTIVE_BOOKING_STATUSES, BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Los tres caminos que no pasan por Mercado Pago: la transferencia que alguien confirma a
 * mano, la aprobación de lo que hay que coordinar, y el vencimiento de lo que nadie pagó.
 */

/**
 * ¿Puede cancelar quien reservó, por su cuenta?
 *
 * Parte PURA. Después del plazo solo cancela la institución — no porque el sistema quiera
 * ser rígido, sino porque a esa altura ya se organizó algo alrededor de esa reserva.
 */
export function canCancelByCustomer(input: {
  startAt: Date;
  status: string;
  cancelWindowHours: number;
  now: Date;
}): { ok: true } | { ok: false; motivo: string } {
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, motivo: "Esa reserva ya no está activa." };
  }

  const faltanMs = input.startAt.getTime() - input.now.getTime();
  if (faltanMs <= 0) return { ok: false, motivo: "Esa reserva ya empezó." };

  const ventanaMs = Math.max(0, input.cancelWindowHours) * 60 * 60 * 1000;
  if (faltanMs < ventanaMs) {
    return {
      ok: false,
      motivo: `Se puede cancelar hasta ${input.cancelWindowHours} horas antes. Escribile a la Secretaría.`,
    };
  }

  return { ok: true };
}

/**
 * La Secretaría confirma que la transferencia llegó.
 *
 * Ese dinero **no pasa por Mercado Pago**, así que no hay de dónde retener la comisión: se
 * anota como deuda de la institución y se cobra de los próximos cobros que sí entren por
 * ahí. Es exactamente lo que ya pasa con las cuotas cobradas en efectivo.
 */
export async function confirmTransferPayment(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const feeBps = await getPlatformFeeBps(input.workspaceId, BOOKINGS_MODULE_KEY);

    return await prisma.$transaction(async (tx) => {
      const reserva = await tx.booking.findFirst({
        where: { id: input.bookingId, workspaceId: input.workspaceId },
        select: { id: true, status: true, paymentStatus: true, totalArs: true },
      });
      if (!reserva) return { ok: false, error: "No encontramos esa reserva." };
      if (reserva.paymentStatus === "PAID") return { ok: false, error: "Esa reserva ya está paga." };
      if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(reserva.status)) {
        return { ok: false, error: "Esa reserva ya no está activa." };
      }

      const totalMinor = decimalArsToMinor(reserva.totalArs);
      const feeMinor = splitMinorByPlatformFee(totalMinor, feeBps).feeMinor;

      await tx.booking.update({
        where: { id: reserva.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          paidAt: new Date(),
          holdExpiresAt: null,
          decidedByUserId: input.byUserId,
          feeBps,
          feeArs: minorToDecimalString(feeMinor),
        },
      });

      await recordAccrual(tx, {
        workspaceId: input.workspaceId,
        bookingId: reserva.id,
        amountMinor: feeMinor,
        note: `Comisión de la reserva ${reserva.id}, cobrada por transferencia`,
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo confirmar la transferencia", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos confirmar el pago. Probá de nuevo en un rato." };
  }
}

/**
 * La institución resuelve una reserva que estaba a aprobar.
 *
 * Puede quitar extras que no se pudieron conseguir —la modelo que no estaba disponible—, y
 * el total se recalcula con lo que quedó. Recién ahí la reserva pasa a esperar el pago.
 *
 * Los extras quitados pasan a `REMOVED` y dejan de comprometer inventario en la MISMA
 * transacción: si se hiciera en dos pasos, entre uno y otro ese flash figuraría tomado.
 */
export async function approveBooking(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number;
  removeExtraLineIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const reserva = await tx.booking.findFirst({
        where: { id: input.bookingId, workspaceId: input.workspaceId, status: "PENDING_APPROVAL" },
        select: {
          id: true,
          totalArs: true,
          extraLines: { select: { id: true, amountArs: true, status: true } },
        },
      });
      if (!reserva) return { ok: false, error: "Esa reserva no está esperando aprobación." };

      const quitar = new Set(input.removeExtraLineIds);
      const aQuitar = reserva.extraLines.filter((l) => quitar.has(l.id) && l.status !== "REMOVED");

      if (aQuitar.length > 0) {
        await tx.bookingExtraLine.updateMany({
          where: { id: { in: aQuitar.map((l) => l.id) }, bookingId: reserva.id },
          data: { status: "REMOVED" },
        });
      }

      const descontado = aQuitar.reduce((s, l) => s + decimalArsToMinor(l.amountArs), 0);
      const nuevoTotal = Math.max(0, decimalArsToMinor(reserva.totalArs) - descontado);

      // Las líneas que quedan pasan a confirmadas: ya no están "a la espera de que alguien
      // decida", que es lo que significaba PENDING_CONFIRMATION.
      await tx.bookingExtraLine.updateMany({
        where: { bookingId: reserva.id, status: "PENDING_CONFIRMATION" },
        data: { status: "CONFIRMED" },
      });

      const sinCargo = nuevoTotal === 0;
      await tx.booking.update({
        where: { id: reserva.id },
        data: {
          status: sinCargo ? "CONFIRMED" : "HOLD",
          totalArs: minorToDecimalString(nuevoTotal),
          ...(sinCargo ? { paymentMethod: "SIN_CARGO", paymentStatus: "NOT_REQUIRED" } : {}),
          decidedByUserId: input.byUserId,
        },
      });

      return { ok: true };
    });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo aprobar", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos aprobar la reserva. Probá de nuevo en un rato." };
  }
}

/**
 * Libera los bloqueos que nadie pagó ni resolvió.
 *
 * **Idempotente**: correrla dos veces deja el mismo resultado. Un bloqueo vencido no puede
 * volver a vencer, y una reserva pagada nunca entra en el filtro.
 */
export async function expireStaleHolds(now: Date = new Date()): Promise<{ expiradas: number }> {
  const r = await prisma.booking.updateMany({
    where: {
      status: { in: ["HOLD", "PENDING_APPROVAL"] },
      paymentStatus: { not: "PAID" },
      holdExpiresAt: { not: null, lte: now },
    },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  return { expiradas: r.count };
}

/**
 * Cancela la reserva cuyo evento se borró en el calendario de Google.
 *
 * Es el espejo hacia atrás: si la Secretaría borra el evento, la reserva deja de existir
 * también en FotoOffice. Antes quedaba "Confirmada" en el portal del socio mientras el
 * espacio figuraba libre en el calendario, que es la peor de las dos verdades posibles.
 *
 * **Solo actúa sobre un borrado explícito.** Google avisa de un evento borrado con
 * `status: "cancelled"`; nunca se deduce una cancelación de la ausencia de un evento en el
 * listado, porque un token vencido recarga la ventana entera y "ausente" pasaría a
 * significar "borrado" para todas las reservas de golpe.
 *
 * Se limita al espacio del calendario que se está sincronizando: un identificador de evento
 * no puede alcanzar una reserva de otro espacio. Y solo toca reservas activas, así que
 * volver a ver el mismo borrado no cambia nada — importa, porque FotoOffice borra sus
 * propios eventos al cancelar y después los lee de vuelta.
 */
export async function cancelBookingForDeletedEvent(input: {
  spaceId: string;
  googleEventId: string;
}): Promise<{ canceladas: number; pagadas: number }> {
  const afectadas = await prisma.booking.findMany({
    where: {
      spaceId: input.spaceId,
      googleEventId: input.googleEventId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
    },
    select: { id: true, paymentStatus: true },
  });
  if (afectadas.length === 0) return { canceladas: 0, pagadas: 0 };

  const r = await prisma.booking.updateMany({
    where: { id: { in: afectadas.map((b) => b.id) } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "El evento se borró en el calendario de Google.",
      holdExpiresAt: null,
    },
  });

  // Una reserva paga que se cancela borrando un evento deja plata que alguien tiene que
  // devolver. No se decide acá, pero no puede pasar en silencio.
  const pagadas = afectadas.filter((b) => b.paymentStatus === "PAID").length;
  if (pagadas > 0) {
    console.warn("[fotoffice][calendar] se cancelaron reservas PAGAS por un borrado en Google", {
      spaceId: input.spaceId,
      googleEventId: input.googleEventId,
      pagadas,
    });
  }

  return { canceladas: r.count, pagadas };
}
