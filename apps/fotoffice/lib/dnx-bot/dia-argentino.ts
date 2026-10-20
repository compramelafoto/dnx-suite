/** Día y mes argentinos (`BotUsageDaily.day`, cortes del tope mensual). Nunca UTC. */
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD. */
export function diaArgentino(d: Date = new Date()): string {
  return fmt.format(d);
}

/** YYYY-MM. */
export function mesArgentino(d: Date = new Date()): string {
  return diaArgentino(d).slice(0, 7);
}

/** "2026-12" → "2027-01". */
export function mesSiguiente(mes: string): string {
  const anio = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  return m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, "0")}`;
}
