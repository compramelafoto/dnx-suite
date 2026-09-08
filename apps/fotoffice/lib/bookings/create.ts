import "server-only";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from "./constants";
import { checkRange, rejectionMessage } from "./availability";
import { blockingSpaceIds } from "./conflicts";
import { quoteBooking, type CustomerType, type Quote } from "./pricing";
import { getBookingSettings, getSpace, listCompatibilities, listSpaces } from "./repository";
import { BOOKINGS_TIME_ZONE, addMinutes, type Interval } from "./time";

/**
 * Crear una reserva.
 *
 * ── Dos defensas, no una ──
 *
 * La primera es esta transacción: vuelve a leer la ocupación y a validar el rango contra
 * el motor, con los datos de este instante y no con los que tenía la pantalla.
 *
 * La segunda es la restricción `Booking_sin_solapamiento` de la base. Hace falta igual:
 * entre el "¿está libre?" y el `INSERT` hay un hueco de milisegundos donde otra
 * transacción puede insertar lo mismo, y ninguna verificación hecha en la aplicación puede
 * cerrarlo. Cuando eso pasa, el `INSERT` falla y acá se traduce a "ese horario se acaba de
 * ocupar" — que es exactamente lo que ocurrió.
 *
 * La transacción no es redundante: sin ella, el choque ENTRE espacios incompatibles (que
 * la restricción no cubre) no se detectaría nunca.
 */

export type CreateBookingInput = {
  workspaceId: string;
  spaceId: string;
  range: Interval;
  customerType: CustomerType;
  memberId: string | null;
  userId: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  /** Minutos bonificados que le quedan al socio este mes. Cero para un no socio. */
  freeMinutesAvailable: number;
  /** MERCADO_PAGO | TRANSFERENCIA | SIN_CARGO | PRESENCIAL */
  paymentMethod: string;
  notes?: string | null;
  /** Quién la carga, cuando la carga el equipo. Null si la carga la propia persona. */
  createdByUserId: number | null;
  now?: Date;
};

export type CreateBookingResult =
  | { ok: true; bookingId: string; quote: Quote; status: BookingStatus }
  | { ok: false; error: string };

const CHOQUE = "Ese horario se acaba de ocupar. Elegí otro.";

/**
 * ¿Falló porque otra reserva ganó la carrera?
 *
 * Postgres devuelve `23P01` (exclusion_violation), pero **Prisma no lo expone**: llega como
 * `PrismaClientUnknownRequestError` con `code` y `meta` en `undefined` y el código de
 * Postgres enterrado en el texto del mensaje. Verificado contra la base real.
 *
 * Se miran los tres caminos igual —el texto, el código propio y el de Prisma— porque el
 * primero es el que funciona hoy y los otros dos son gratis si algún día Prisma mejora.
 */
export function isOverlapConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: unknown;
    meta?: { code?: unknown; message?: unknown };
    message?: unknown;
  };
  if (e.code === "23P01" || e.meta?.code === "23P01") return true;
  const textos = [e.message, e.meta?.message].filter((t): t is string => typeof t === "string");
  return textos.some((t) => t.includes("Booking_sin_solapamiento") || t.includes("23P01"));
}

/** Motivo de negocio, no falla técnica: viaja tal cual a la persona. */
class BookingRejected extends Error {}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const now = input.now ?? new Date();

  const [espacio, espacios, compatibilidades, settings] = await Promise.all([
    getSpace(input.workspaceId, input.spaceId),
    listSpaces(input.workspaceId, { includeInactive: true }),
    listCompatibilities(input.workspaceId),
    getBookingSettings(input.workspaceId),
  ]);

  if (!espacio) return { ok: false, error: "Ese espacio no existe." };
  if (!espacio.active) return { ok: false, error: "Ese espacio no está disponible." };
  if (input.customerType === "NON_MEMBER" && !espacio.allowsNonMembers) {
    return { ok: false, error: "Este espacio se alquila solo a socios." };
  }

  const bloquean = blockingSpaceIds(
    input.spaceId,
    espacios.map((e) => e.id),
    compatibilidades,
  );

  const minutos = (input.range.endAt.getTime() - input.range.startAt.getTime()) / 60_000;
  const quote = quoteBooking({
    minutes: minutos,
    customerType: input.customerType,
    memberHourlyPriceMinor: espacio.memberHourlyPriceMinor,
    nonMemberHourlyPriceMinor: espacio.nonMemberHourlyPriceMinor,
    freeMinutesAvailable: input.freeMinutesAvailable,
  });

  // Una reserva sin cargo no espera ningún pago; una que requiere aprobación no cobra
  // hasta que alguien decida. El resto nace bloqueada con su vencimiento.
  const sinCargo = quote.totalMinor === 0;
  const status: BookingStatus = espacio.requiresApproval
    ? "PENDING_APPROVAL"
    : sinCargo || input.paymentMethod === "PRESENCIAL"
      ? "CONFIRMED"
      : "HOLD";

  const holdExpiresAt =
    status === "CONFIRMED"
      ? null
      : // Nunca más tarde que el comienzo de la reserva: un bloqueo que vence después de
        // que la reserva empezó no protege nada.
        new Date(
          Math.min(
            addMinutes(now, settings.holdHours * 60).getTime(),
            input.range.startAt.getTime(),
          ),
        );

  try {
    const creada = await prisma.$transaction(async (tx) => {
      const ocupacion = await tx.booking.findMany({
        where: {
          workspaceId: input.workspaceId,
          spaceId: { in: bloquean },
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          startAt: { lt: input.range.endAt },
          endAt: { gt: input.range.startAt },
        },
        select: { startAt: true, endAt: true },
      });

      const cierres = await tx.bookingClosure.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: [{ spaceId: null }, { spaceId: input.spaceId }],
          startAt: { lt: input.range.endAt },
          endAt: { gt: input.range.startAt },
        },
        select: { startAt: true, endAt: true },
      });

      const veredicto = checkRange(input.range, {
        space: espacio.rules,
        weeklyHours: espacio.weeklyHours,
        closures: cierres,
        busy: ocupacion,
        now,
        timeZone: BOOKINGS_TIME_ZONE,
      });
      if (!veredicto.ok) throw new BookingRejected(rejectionMessage(veredicto.reason));

      return tx.booking.create({
        data: {
          workspaceId: input.workspaceId,
          spaceId: input.spaceId,
          startAt: input.range.startAt,
          endAt: input.range.endAt,
          status,
          holdExpiresAt,
          memberId: input.memberId,
          userId: input.userId,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          customerType: input.customerType,
          billedMinutes: quote.billedMinutes,
          freeMinutesUsed: quote.freeMinutesUsed,
          hourlyPriceArs: minorToDecimalString(quote.hourlyPriceMinor),
          totalArs: minorToDecimalString(quote.totalMinor),
          paymentMethod: sinCargo ? "SIN_CARGO" : input.paymentMethod,
          paymentStatus: sinCargo ? "NOT_REQUIRED" : "PENDING",
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId,
        },
        select: { id: true },
      });
    });

    return { ok: true, bookingId: creada.id, quote, status };
  } catch (error) {
    if (error instanceof BookingRejected) return { ok: false, error: error.message };
    if (isOverlapConstraintError(error)) return { ok: false, error: CHOQUE };

    console.error("[fotoffice][reservas] no se pudo crear la reserva", {
      workspaceId: input.workspaceId,
      spaceId: input.spaceId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos guardar la reserva. Probá de nuevo en un rato." };
  }
}

/**
 * Cancelar libera el horario. **No devuelve dinero**: si estaba paga, la devolución la
 * resuelve la institución por fuera y queda anotada en el motivo. Devolver por Mercado Pago
 * desde el sistema es un circuito propio y no entra en esta etapa.
 */
export async function cancelBooking(input: {
  workspaceId: string;
  bookingId: string;
  byUserId: number | null;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actualizadas = await prisma.booking.updateMany({
      where: {
        id: input.bookingId,
        workspaceId: input.workspaceId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: input.byUserId,
        cancelReason: input.reason.slice(0, 500),
        holdExpiresAt: null,
      },
    });
    if (actualizadas.count === 0) return { ok: false, error: "Esa reserva ya no está activa." };
    return { ok: true };
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo cancelar", {
      bookingId: input.bookingId,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos cancelar la reserva. Probá de nuevo en un rato." };
  }
}
