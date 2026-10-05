/** El valor de un `<input type="datetime-local">` en hora argentina ("2026-10-15T19:30"). Módulo PURO. */
export function toLocalDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  // Algunos motores devuelven "24" para la medianoche con hour12: false.
  const hora = p("hour") === "24" ? "00" : p("hour");
  return `${p("year")}-${p("month")}-${p("day")}T${hora}:${p("minute")}`;
}
