/**
 * Reglas de tiempo de las reservas. Módulo PURO: sin base y sin red.
 *
 * Todo se guarda en UTC y se interpreta en la zona de la institución. La conversión no es
 * un detalle cosmético: "los sábados de 9 a 13" es una regla escrita en hora local, y
 * evaluarla en UTC corre el horario tres horas y, cerca de la medianoche, un día entero.
 *
 * La zona viaja como parámetro en vez de estar clavada acá. Hoy hay una sola institución y
 * es de Rosario; el día que haya una de otra provincia, esto no se toca.
 */

export const BOOKINGS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type Interval = { startAt: Date; endAt: Date };

export type LocalMoment = {
  /** 0 domingo … 6 sábado, en la zona pedida. */
  weekday: number;
  /** Minutos desde la medianoche local. 540 = 09:00. */
  minuteOfDay: number;
  /** "2026-09-19", en la zona pedida. */
  ymd: string;
};

const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Se usa `Intl` y no aritmética de husos porque Argentina cambió de huso más de una vez y
 * podría volver a hacerlo. La base de datos de zonas horarias sabe eso; una resta de tres
 * horas escrita a mano, no.
 */
export function localMoment(at: Date, timeZone: string): LocalMoment {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // `hour12: false` puede devolver "24" para la medianoche según el entorno.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  return {
    weekday: Math.max(0, DIAS.indexOf(parts.weekday)),
    minuteOfDay: hour * 60 + minute,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** "2026-09". El mes al que pertenece un instante EN LA ZONA LOCAL. */
export function monthKeyOf(at: Date, timeZone: string): string {
  return localMoment(at, timeZone).ymd.slice(0, 7);
}

/**
 * Rango medio abierto `[inicio, fin)`: dos reservas pegadas NO se pisan.
 *
 * Es la convención que hace que "de 14 a 16" y "de 16 a 18" puedan convivir, que es lo que
 * cualquiera espera de una agenda. La restricción de la base usa el mismo criterio.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < a.endAt.getTime();
}

/** El tiempo de limpieza ocupa a los dos lados de la reserva. */
export function expandInterval(interval: Interval, bufferMinutes: number): Interval {
  if (bufferMinutes <= 0) return interval;
  return {
    startAt: addMinutes(interval.startAt, -bufferMinutes),
    endAt: addMinutes(interval.endAt, bufferMinutes),
  };
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}

export function minuteOfDayToLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
