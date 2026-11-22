/**
 * Las fechas del sorteo, en hora argentina. Módulo PURO.
 *
 * Argentina no tiene horario de verano desde 2009: se trabaja con UTC−3 fijo, que es lo que
 * hace el resto de CLF para los informes.
 */

const OFFSET_HORAS = 3;

/** El instante de un día y hora de Argentina. `month` va de 1 a 12. */
export function argentinaDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + OFFSET_HORAS, minute));
}

/** Año, mes, día y hora en Argentina de un instante. */
export function argentinaParts(d: Date): { year: number; month: number; day: number; hour: number } {
  const local = new Date(d.getTime() - OFFSET_HORAS * 3_600_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
  };
}

/** `YYYY-MM` del mes en curso en Argentina. */
export function periodOf(d: Date): string {
  const p = argentinaParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function parsePeriod(period: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) throw new Error(`Período inválido: ${period}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Período inválido: ${period}`);
  return { year, month };
}

const MESES = [
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
];

export function monthName(period: string): string {
  const { year, month } = parsePeriod(period);
  return `${MESES[month - 1]} de ${year}`;
}

/**
 * Las fechas del sorteo mensual de un período.
 *
 * - Ventas: desde el día 1 a las 0 h hasta el día 1 del mes siguiente a las 0 h (sin incluir).
 * - El padrón cierra apenas termina el mes: así cuenta todas las ventas y nada más.
 * - El acto es el `drawDay` del mes siguiente a las `drawHour`. Con `drawDay` ≥ 2 siempre hay
 *   por lo menos 24 h entre el cierre y el acto, que es lo que hace verificable el sorteo.
 */
export function monthlyWindow(
  period: string,
  drawDay: number,
  drawHour: number,
): { salesFrom: Date; salesTo: Date; entriesCloseAt: Date; drawsAt: Date } {
  const { year, month } = parsePeriod(period);
  const sigAnio = month === 12 ? year + 1 : year;
  const sigMes = month === 12 ? 1 : month + 1;
  const dia = Math.min(Math.max(Math.trunc(drawDay), 2), 28);
  const hora = Math.min(Math.max(Math.trunc(drawHour), 0), 23);
  const salesFrom = argentinaDate(year, month, 1);
  const salesTo = argentinaDate(sigAnio, sigMes, 1);
  return {
    salesFrom,
    salesTo,
    entriesCloseAt: salesTo,
    drawsAt: argentinaDate(sigAnio, sigMes, dia, hora),
  };
}

/** "5 de diciembre de 2026, 20:00 h", en hora argentina. */
export function formatArgentina(d: Date, withTime = true): string {
  const p = argentinaParts(d);
  const local = new Date(d.getTime() - OFFSET_HORAS * 3_600_000);
  const minutos = String(local.getUTCMinutes()).padStart(2, "0");
  const fecha = `${p.day} de ${MESES[p.month - 1]} de ${p.year}`;
  return withTime ? `${fecha}, ${String(p.hour).padStart(2, "0")}:${minutos} h` : fecha;
}

/** Para un `<input type="datetime-local">`: "2026-12-05T20:00" en hora argentina. */
export function toArgentinaInput(d: Date): string {
  const local = new Date(d.getTime() - OFFSET_HORAS * 3_600_000);
  return local.toISOString().slice(0, 16);
}

/** Lo inverso: "2026-12-05T20:00" (hora argentina) a un instante. */
export function fromArgentinaInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  return argentinaDate(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}
