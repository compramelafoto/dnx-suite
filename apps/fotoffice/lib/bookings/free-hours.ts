import "server-only";
import { prisma } from "@repo/db";
import { ACTIVE_BOOKING_STATUSES } from "./constants";
import { BOOKINGS_TIME_ZONE, localMoment, monthKeyOf } from "./time";

/**
 * Las horas bonificadas que le quedan al socio este mes, en un espacio.
 *
 * **No hace falta ninguna tabla.** "No se acumulan" significa que la bolsa se calcula
 * contando las reservas del mes calendario: el 1° arranca de cero solo, sin ningún proceso
 * que la reinicie y que pueda fallar o correrse.
 *
 * El mes es el LOCAL, no el de UTC: una reserva del 30 de septiembre a las 22 de Rosario
 * es de octubre en UTC, y contarla en octubre le regalaría dos horas al socio.
 */

export type FreeHoursBalance = {
  grantedMinutes: number;
  usedMinutes: number;
  availableMinutes: number;
  monthKey: string;
};

function entero(v: number): number {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Parte pura: dadas las horas otorgadas y las usadas, cuánto queda. */
export function computeFreeHoursBalance(input: {
  grantedHoursPerMonth: number;
  usedMinutes: number;
  monthKey: string;
}): FreeHoursBalance {
  const grantedMinutes = entero(input.grantedHoursPerMonth) * 60;
  const usedMinutes = entero(input.usedMinutes);
  return {
    grantedMinutes,
    usedMinutes,
    // Nunca negativa: si el dueño bajó las horas con reservas ya hechas, la bolsa es cero,
    // no una deuda que el socio tendría que pagar de más.
    availableMinutes: Math.max(0, grantedMinutes - usedMinutes),
    monthKey: input.monthKey,
  };
}

const MINUTO = 60_000;

/**
 * El mes calendario local, en instantes.
 *
 * Se construye pidiéndole a la zona qué día es y retrocediendo al día 1 a la medianoche.
 * Misma técnica que `weekRange`, por la misma razón: no hay biblioteca de fechas.
 */
export function monthBoundsFor(at: Date, timeZone: string): { startAt: Date; endAt: Date } {
  const m = localMoment(at, timeZone);
  const dia = Number(m.ymd.slice(8, 10));
  const startAt = new Date(at.getTime() - ((dia - 1) * 24 * 60 + m.minuteOfDay) * MINUTO);

  // Para el borde de arriba se avanza 32 días —más que cualquier mes— y se vuelve al día 1.
  const dentroDelSiguiente = new Date(startAt.getTime() + 32 * 24 * 60 * MINUTO);
  const m2 = localMoment(dentroDelSiguiente, timeZone);
  const dia2 = Number(m2.ymd.slice(8, 10));
  const endAt = new Date(
    dentroDelSiguiente.getTime() - ((dia2 - 1) * 24 * 60 + m2.minuteOfDay) * MINUTO,
  );

  return { startAt, endAt };
}

/**
 * Lo mismo, consultando la base.
 *
 * Cuentan las reservas que OCUPAN —`HOLD`, `PENDING_APPROVAL`, `CONFIRMED`—: una que está
 * esperando el pago ya consumió la bolsa, porque si no el socio podría abrir cinco
 * checkouts y gastar cinco veces las mismas dos horas.
 */
export async function loadFreeMinutesAvailable(input: {
  workspaceId: string;
  memberId: string;
  spaceId: string;
  grantedHoursPerMonth: number;
  at?: Date;
}): Promise<FreeHoursBalance> {
  const at = input.at ?? new Date();
  const { startAt, endAt } = monthBoundsFor(at, BOOKINGS_TIME_ZONE);

  const r = await prisma.booking.aggregate({
    where: {
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      spaceId: input.spaceId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startAt: { gte: startAt, lt: endAt },
    },
    _sum: { freeMinutesUsed: true },
  });

  return computeFreeHoursBalance({
    grantedHoursPerMonth: input.grantedHoursPerMonth,
    usedMinutes: r._sum.freeMinutesUsed ?? 0,
    monthKey: monthKeyOf(at, BOOKINGS_TIME_ZONE),
  });
}
