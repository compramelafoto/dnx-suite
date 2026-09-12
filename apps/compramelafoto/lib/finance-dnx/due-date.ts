import type { ExpenseStatus } from "@repo/finance-control";

/**
 * Estados que ya saldan la deuda: si la factura está pagada o reembolsada,
 * no importa que la fecha de vencimiento haya pasado, no hay nada que
 * avisar.
 */
const ESTADOS_SALDADOS = new Set<ExpenseStatus>(["PAGADO", "REEMBOLSADO"]);

/**
 * Decide qué fila se pinta de rojo en la tabla de gastos: una factura está
 * vencida e impaga cuando tiene fecha de vencimiento, esa fecha ya pasó, y
 * el estado no es uno de los que cierran la deuda. Es la alerta que habría
 * evitado enterarse cuatro meses tarde de que Neon venía rechazando
 * facturas desde mayo.
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
  return fecha.getTime() < now.getTime();
}
