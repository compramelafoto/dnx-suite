/**
 * Presupuesto de tiempo para cada workspace durante una corrida de la tarea programada.
 */

/**
 * Calcula el presupuesto de tiempo (en ms) para el siguiente workspace a procesar.
 * Reparte el tiempo restante equitativamente entre los workspaces pendientes.
 *
 * @param restanteMs - Tiempo restante de los 270 segundos totales (antes de este workspace).
 * @param pendientes - Cantidad de workspaces todavía por procesar (incluido este).
 * @returns Presupuesto en ms para este workspace.
 */
export function presupuestoPorWorkspace(restanteMs: number, pendientes: number): number {
  if (pendientes <= 0) return 0;
  return Math.floor(restanteMs / pendientes);
}
