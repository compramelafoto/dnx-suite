import type { ExpenseStatus } from "@repo/finance-control";

/**
 * Estados que ya saldan la deuda: si la factura está pagada o reembolsada,
 * no importa que la fecha de vencimiento haya pasado, no hay nada que
 * avisar.
 */
const ESTADOS_SALDADOS = new Set<ExpenseStatus>(["PAGADO", "REEMBOLSADO"]);

const HUSO_ARGENTINA = "America/Argentina/Buenos_Aires";

/**
 * `dueDate` se guarda como medianoche UTC del día calendario que se eligió
 * en el `<input type="date">` (ver `fechaParaInput`/`parseExpenseForm`): no
 * representa un instante real, representa "ese día". Por eso el día que
 * cuenta es el día calendario en UTC de esa fecha (no el que resulte de
 * mirarla con otro huso horario) — `toISOString().slice(0, 10)` lo extrae
 * tal cual quedó guardado.
 */
function diaCalendarioUTC(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

const FORMATO_DIA_ARGENTINA = new Intl.DateTimeFormat("en-CA", {
  timeZone: HUSO_ARGENTINA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día calendario de "ahora", visto con el huso horario de Argentina. */
function diaCalendarioArgentina(fecha: Date): string {
  return FORMATO_DIA_ARGENTINA.format(fecha);
}

/**
 * Decide qué fila se pinta de rojo en la tabla de gastos: una factura está
 * vencida e impaga cuando tiene fecha de vencimiento, esa fecha ya pasó, y
 * el estado no es uno de los que cierran la deuda. Es la alerta que habría
 * evitado enterarse cuatro meses tarde de que Neon venía rechazando
 * facturas desde mayo.
 *
 * La comparación es entre DÍAS CALENDARIO, no entre instantes: comparar
 * `getTime()` directamente corría la alerta ~3 horas antes en huso horario
 * argentino (a las 21:00 en Argentina ya es medianoche UTC, así que una
 * factura que vence mañana se pintaba de rojo hoy a la noche). Acá se
 * compara el día calendario guardado contra el día calendario de "ahora"
 * en Argentina.
 *
 * Decisión de producto: una factura que vence HOY todavía no se pinta de
 * rojo — "vencida" quiere decir que la fecha ya pasó, no que es hoy. Se
 * pinta de rojo recién al otro día.
 */
export function isOverdueUnpaid(
  dueDate: string | Date | null | undefined,
  status: ExpenseStatus,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  if (ESTADOS_SALDADOS.has(status)) return false;
  const fecha = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(fecha.getTime())) return false;
  return diaCalendarioUTC(fecha) < diaCalendarioArgentina(now);
}
