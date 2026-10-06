import { ZONA_ARGENTINA } from "@/lib/fecha-ar";

/**
 * La semana del Clickatoner de la semana: de viernes 00:00 a jueves 23:59, hora argentina.
 *
 * Módulo puro. Es la misma regla que el Socio de la semana de FOTOFFICE
 * (`apps/fotoffice/lib/spotlight/week.ts`); se repite acá porque son dos aplicaciones con bases
 * distintas y no comparten código de dominio.
 */

const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VIERNES = 5;

function momentoLocal(at: Date, timeZone: string): { weekday: number; minuteOfDay: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    weekday: Math.max(0, DIAS.indexOf(parts.weekday ?? "")),
    minuteOfDay: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

/** El viernes 00:00 local de la semana a la que pertenece `at`, como instante UTC. */
export function clickatonerWeekStart(at: Date, timeZone = ZONA_ARGENTINA): Date {
  const local = momentoLocal(at, timeZone);
  const dias = (local.weekday - VIERNES + 7) % 7;
  const inicio = at.getTime() - (dias * 24 * 60 + local.minuteOfDay) * 60_000;
  // Sin segundos: dos llamadas de la misma semana tienen que dar la misma clave exacta.
  return new Date(Math.floor(inicio / 60_000) * 60_000);
}

/** "del viernes 9 al jueves 15 de octubre". */
export function clickatonerWeekLabel(weekStart: Date, timeZone = ZONA_ARGENTINA): string {
  const fin = new Date(weekStart.getTime() + 6 * 24 * 60 * 60_000);
  const dia = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "long", day: "numeric" });
  const mes = new Intl.DateTimeFormat("es-AR", { timeZone, month: "long" });
  return mes.format(weekStart) === mes.format(fin)
    ? `del ${dia.format(weekStart)} al ${dia.format(fin)} de ${mes.format(fin)}`
    : `del ${dia.format(weekStart)} de ${mes.format(weekStart)} al ${dia.format(fin)} de ${mes.format(fin)}`;
}
