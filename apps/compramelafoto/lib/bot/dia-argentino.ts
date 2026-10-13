const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
});
export function argentinaDay(d: Date = new Date()): string {
  return fmt.format(d); // en-CA da YYYY-MM-DD
}
export function argentinaMonthPrefix(d: Date = new Date()): string {
  return argentinaDay(d).slice(0, 7);
}
