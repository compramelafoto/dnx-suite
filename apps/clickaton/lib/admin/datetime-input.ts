/**
 * Fechas de los campos `datetime-local` del panel.
 *
 * Un `<input type="datetime-local">` no lleva zona horaria: lo que se escribe es
 * hora de pared del evento. Antes se convertía con el huso del runtime, que en
 * Vercel es UTC, así que "23:59" quedaba grabado como 23:59 UTC = 20:59 en
 * Argentina y la inscripción cerraba 3 horas antes de lo previsto. Acá la zona
 * es explícita en las dos direcciones.
 */

import { ZONA_ARGENTINA, zonaSegura } from "@/lib/fecha-ar";

/** Operaciones Clickatón: -03:00 todo el año, sin horario de verano. */
export const DEFAULT_ADMIN_TIME_ZONE = ZONA_ARGENTINA;

/** Una zona mal escrita no debe tumbar el panel: se cae al default. */
export const safeTimeZone = zonaSegura;

/** Valor de `datetime-local`: `YYYY-MM-DDTHH:mm`, con segundos opcionales. */
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Diferencia entre la hora de pared en `timeZone` y UTC, en ese instante. */
function offsetMsAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // formatToParts no devuelve milisegundos: se descuentan del instante original.
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/** Hora de pared en `timeZone` → instante real. */
function wallTimeToInstant(parts: ZonedParts, timeZone: string): Date {
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // Primera aproximación con el desfase del instante candidato, y una segunda
  // pasada por si ese desfase cambia (arranque del horario de verano).
  const firstGuess = new Date(asUtc - offsetMsAt(new Date(asUtc), timeZone));
  return new Date(asUtc - offsetMsAt(firstGuess, timeZone));
}

/**
 * Convierte Date al valor de un `<input type="datetime-local">`, expresado en
 * la zona horaria indicada (por defecto, hora argentina).
 */
export function toDateTimeLocalValue(
  value: Date | null | undefined,
  timeZone: string = DEFAULT_ADMIN_TIME_ZONE,
): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  const p = zonedParts(value, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Parsea el valor de un `datetime-local` como hora de pared de `timeZone`.
 * Un ISO con zona explícita (`Z` u offset) se respeta tal cual. Vacío → null.
 */
export function parseDateTimeInput(
  value: string | null | undefined,
  timeZone: string = DEFAULT_ADMIN_TIME_ZONE,
): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const wall = WALL_TIME.exec(trimmed);
  if (wall) {
    const date = wallTimeToInstant(
      {
        year: Number(wall[1]),
        month: Number(wall[2]),
        day: Number(wall[3]),
        hour: Number(wall[4]),
        minute: Number(wall[5]),
        second: Number(wall[6] ?? "0"),
      },
      timeZone,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatAdminDateTime(
  value: Date | null | undefined,
  timezone = DEFAULT_ADMIN_TIME_ZONE,
): string {
  if (!value || Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: safeTimeZone(timezone),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
