/**
 * Decisión pura del aviso de Finanzas DNX. Antes también vivía acá el armado
 * del correo del cron diario (`buildAlertEmail`); ese correo se dio de baja
 * porque duplicaba el Informe Diario, que ya llega todos los días — ahora el
 * aviso de Finanzas es una sección más de ese informe (ver
 * `@repo/ops-daily-report/collectors/finance`). Esta función sigue viva
 * porque el adaptador Prisma de esa sección la usa para decidir desde cuándo
 * tiene sentido reclamar los gastos sin cargar.
 */

/**
 * Antes del día 5 del mes es normal que todavía no esté cargado el gasto de
 * algún proveedor: las facturas no terminaron de llegar. Recién a partir del
 * día 5 la ausencia empieza a ser sospechosa y vale la pena reclamarla.
 */
export function shouldNagAboutMissingExpenses(day: number): boolean {
  return day >= 5;
}
