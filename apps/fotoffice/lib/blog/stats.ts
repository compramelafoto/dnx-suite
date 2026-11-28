/**
 * Estadísticas del blog: lo que no toca la base. Período elegido y la lista de días (en hora
 * argentina) que va en el gráfico, con ceros donde nadie leyó.
 *
 * Qué se mide: una «lectura» es una persona abriendo un artículo; la misma persona releyendo el
 * mismo artículo no suma (ver `incrementViewCount` en `@repo/content`). Se cuenta desde que
 * existe el registro de vistas (02/10/2026).
 */

export const BLOG_STATS_PERIODS = [7, 30, 90] as const;
export type BlogStatsPeriod = (typeof BLOG_STATS_PERIODS)[number];

export function parseBlogStatsPeriod(raw: string | undefined | null): BlogStatsPeriod {
  const n = Number(raw);
  return (BLOG_STATS_PERIODS as readonly number[]).includes(n) ? (n as BlogStatsPeriod) : 30;
}

const AR_TZ = "America/Argentina/Buenos_Aires";

/** `YYYY-MM-DD` del día argentino de una fecha. */
export function arDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Los `days` días argentinos que terminan hoy, del más viejo al más nuevo. */
export function arDayRange(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  // Argentina no tiene horario de verano: un día son siempre 24 h.
  for (let i = days - 1; i >= 0; i--) out.push(arDay(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

/** Comienzo (en UTC, `YYYY-MM-DD HH:MM:SS`) del primer día del período: así se compara con `viewedAt`. */
export function periodStartUtc(days: number, now: Date = new Date()): string {
  const first = arDayRange(days, now)[0]!;
  // 00:00 en Argentina (UTC-3) son las 03:00 UTC.
  return `${first} 03:00:00`;
}

export type DayCount = { day: string; reads: number };

export function fillDays(range: string[], rows: { day: string; reads: number }[]): DayCount[] {
  const map = new Map(rows.map((r) => [r.day, r.reads]));
  return range.map((day) => ({ day, reads: map.get(day) ?? 0 }));
}
