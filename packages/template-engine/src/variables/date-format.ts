/** Timezone por defecto Clickatón / Argentina. */
export const CLICKATON_DEFAULT_TIMEZONE = "America/Argentina/Cordoba";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function partsFromDate(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; weekday: number } | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = WEEKDAY_SHORT_TO_INDEX[get("weekday") ?? "Sun"] ?? 0;
  if (!year || !month || !day) return null;
  return { year, month, day, weekday };
}

/**
 * Interpreta fechas de calendario (YYYY-MM-DD) o Date/ISO
 * ancladas al timezone indicado (evita corrimientos por UTC).
 */
export function toZonedCalendarParts(
  value: unknown,
  timeZone: string = CLICKATON_DEFAULT_TIMEZONE
): { year: number; month: number; day: number; weekday: number } | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      // 15:00 UTC ≈ mediodía en Argentina → mismo día civil
      const probe = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
      const zoned = partsFromDate(probe, timeZone);
      if (!zoned) return { year, month, day, weekday: probe.getUTCDay() };
      return { year, month, day, weekday: zoned.weekday };
    }
  }

  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return partsFromDate(date, timeZone);
}

export function formatDateShort(
  value: unknown,
  timeZone: string = CLICKATON_DEFAULT_TIMEZONE
): string {
  const p = toZonedCalendarParts(value, timeZone);
  if (!p) return value == null ? "" : String(value);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export function formatDateLong(
  value: unknown,
  timeZone: string = CLICKATON_DEFAULT_TIMEZONE
): string {
  const p = toZonedCalendarParts(value, timeZone);
  if (!p) return value == null ? "" : String(value);
  const month = MONTHS_ES[p.month - 1] ?? "";
  return `${p.day} de ${month}`;
}

export function formatDateLongUppercase(
  value: unknown,
  timeZone: string = CLICKATON_DEFAULT_TIMEZONE
): string {
  const p = toZonedCalendarParts(value, timeZone);
  if (!p) return value == null ? "" : String(value);
  const weekday = (WEEKDAYS_ES[p.weekday] ?? "").toUpperCase();
  const month = (MONTHS_ES[p.month - 1] ?? "").toUpperCase();
  return `${weekday} ${p.day} DE ${month}`;
}

export function formatDateDayMonthUppercase(
  value: unknown,
  timeZone: string = CLICKATON_DEFAULT_TIMEZONE
): string {
  const p = toZonedCalendarParts(value, timeZone);
  if (!p) return value == null ? "" : String(value);
  const month = (MONTHS_ES[p.month - 1] ?? "").toUpperCase();
  return `${p.day} DE ${month}`;
}

export function formatParticipantNumber(value: unknown, digits = 4): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return value == null ? "" : String(value);
  const int = Math.floor(n);
  const s = String(int);
  return s.length >= digits ? s : s.padStart(digits, "0");
}
