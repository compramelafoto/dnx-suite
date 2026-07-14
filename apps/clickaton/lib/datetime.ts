/**
 * Formateo de fechas públicas (es-AR) respetando timezone de la edición.
 */

type DateFormatOptions = {
  timezone: string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
};

export function formatMarathonDate(
  iso: string,
  { timezone, dateStyle = "long", timeStyle }: DateFormatOptions,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    dateStyle,
    ...(timeStyle ? { timeStyle } : {}),
  }).format(date);
}

export function formatMarathonDateTime(iso: string, timezone: string): string {
  return formatMarathonDate(iso, { timezone, dateStyle: "full", timeStyle: "short" });
}

export function formatMarathonDateRange(
  startAt: string,
  endAt: string,
  timezone: string,
): string {
  const start = formatMarathonDate(startAt, { timezone, dateStyle: "long" });
  const end = formatMarathonDate(endAt, { timezone, dateStyle: "long" });
  if (start === end) return start;
  return `${start} — ${end}`;
}
