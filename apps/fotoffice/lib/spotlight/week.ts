import { addMinutes, localMoment } from "@/lib/bookings/time";

/**
 * La semana del Socio de la semana: de viernes 00:00 a jueves 23:59, hora argentina.
 *
 * Módulo puro. La zona viaja por parámetro, igual que en reservas: la regla "los viernes a la
 * medianoche" está escrita en hora local, y evaluarla en UTC correría el cambio de socio al
 * jueves a las 21.
 */

export const SPOTLIGHT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const VIERNES = 5;

/** El viernes 00:00 local de la semana a la que pertenece `at`, como instante UTC. */
export function spotlightWeekStart(at: Date, timeZone = SPOTLIGHT_TIME_ZONE): Date {
  const local = localMoment(at, timeZone);
  const diasDesdeElViernes = (local.weekday - VIERNES + 7) % 7;
  const inicio = addMinutes(at, -(diasDesdeElViernes * 24 * 60 + local.minuteOfDay));
  // Se descartan segundos y milisegundos: dos llamadas en la misma semana tienen que dar el
  // mismo instante exacto, porque es la clave con la que se busca la semana en la base.
  return new Date(Math.floor(inicio.getTime() / 60_000) * 60_000);
}

/** El viernes siguiente: cuando termina la semana. */
export function spotlightWeekEnd(weekStart: Date): Date {
  return addMinutes(weekStart, 7 * 24 * 60);
}

/** "del viernes 9 al jueves 15 de octubre", para mostrar. */
export function spotlightWeekLabel(weekStart: Date, timeZone = SPOTLIGHT_TIME_ZONE): string {
  const fin = addMinutes(weekStart, 6 * 24 * 60);
  const dia = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "long", day: "numeric" });
  const mes = new Intl.DateTimeFormat("es-AR", { timeZone, month: "long" });
  const mismoMes = mes.format(weekStart) === mes.format(fin);
  return mismoMes
    ? `del ${dia.format(weekStart)} al ${dia.format(fin)} de ${mes.format(fin)}`
    : `del ${dia.format(weekStart)} de ${mes.format(weekStart)} al ${dia.format(fin)} de ${mes.format(fin)}`;
}
