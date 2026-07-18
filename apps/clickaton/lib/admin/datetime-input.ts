/**
 * Convierte Date a valor para `<input type="datetime-local">` (UTC offset local del runtime).
 */
export function toDateTimeLocalValue(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/**
 * Parsea datetime-local o ISO a Date. Vacío → null.
 */
export function parseDateTimeInput(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatAdminDateTime(
  value: Date | null | undefined,
  timezone = "America/Argentina/Cordoba",
): string {
  if (!value || Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
