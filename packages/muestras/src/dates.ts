import { LAST_DAYS_WINDOW } from "./constants";

/**
 * Fechas en hora argentina.
 *
 * Argentina está en UTC−3 todo el año (sin horario de verano), así que el corrimiento es fijo.
 * Las columnas `DateTime` guardan UTC: un día argentino va de las 03:00 UTC de ese día a las
 * 02:59:59.999 UTC del siguiente.
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): [number, number, number] {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Fecha inválida: ${day}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) throw new Error(`Fecha inválida: ${day}`);
  return [y, mo, d];
}

export function dayStartAr(day: string): Date {
  const [y, mo, d] = parseDay(day);
  return new Date(Date.UTC(y, mo - 1, d) + OFFSET_MS);
}

export function dayEndAr(day: string): Date {
  return new Date(dayStartAr(day).getTime() + DAY_MS - 1);
}

export function toArDay(date: Date): string {
  return new Date(date.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });

/** Fecha corta legible en hora argentina, por ejemplo "5 nov". */
export function formatArDay(d: Date): string {
  return FORMATO_DIA.format(d);
}

export type TemporalStatus = "UPCOMING" | "OPEN" | "CLOSED";

/** Próxima / Abierta / Cerrada. No se guarda: se calcula siempre con la hora actual. */
export function temporalStatus(a: { startsAt: Date; endsAt: Date }, now: Date): TemporalStatus {
  if (now.getTime() < a.startsAt.getTime()) return "UPCOMING";
  if (now.getTime() > a.endsAt.getTime()) return "CLOSED";
  return "OPEN";
}

export function isLastDays(a: { startsAt?: Date; endsAt: Date }, now: Date): boolean {
  const remaining = a.endsAt.getTime() - now.getTime();
  if (remaining < 0) return false;
  if (a.startsAt && now.getTime() < a.startsAt.getTime()) return false;
  return remaining <= LAST_DAYS_WINDOW * DAY_MS;
}
