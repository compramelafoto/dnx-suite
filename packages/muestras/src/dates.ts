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

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

function partesAr(d: Date): { y: number; m: number; d: number } {
  const [y, m, dd] = toArDay(d).split("-").map(Number) as [number, number, number];
  return { y, m, d: dd };
}

/** "5 de noviembre de 2026", en hora argentina. Para carteles y catálogos. */
export function formatArDayLong(d: Date): string {
  const p = partesAr(d);
  return `${p.d} de ${MESES[p.m - 1]} de ${p.y}`;
}

/** "Del 5 al 20 de noviembre de 2026", sin repetir mes ni año cuando coinciden. */
export function dateRangeText(startsAt: Date, endsAt: Date): string {
  if (toArDay(startsAt) === toArDay(endsAt)) return formatArDayLong(startsAt);
  const a = partesAr(startsAt);
  const b = partesAr(endsAt);
  if (a.y === b.y && a.m === b.m) return `Del ${a.d} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`;
  if (a.y === b.y) return `Del ${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`;
  return `Del ${formatArDayLong(startsAt)} al ${formatArDayLong(endsAt)}`;
}

/** Suma (o resta) días a un día "AAAA-MM-DD". */
export function addArDays(day: string, n: number): string {
  return toArDay(new Date(dayStartAr(day).getTime() + n * DAY_MS));
}
