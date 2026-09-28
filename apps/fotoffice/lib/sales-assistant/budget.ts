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
  if (pendientes <= 0 || restanteMs < 0) return 0;
  return Math.floor(restanteMs / pendientes);
}

/**
 * Decide si omitir un workspace o procesarlo con presupuesto.
 *
 * Un workspace se omite si el tiempo total restante es insuficiente (< 15 s).
 * De lo contrario, se calcula el presupuesto equitativo para este workspace.
 *
 * @param restanteMs - Tiempo total restante de los 270 segundos (ANTES de procesar este).
 * @param pendientes - Cantidad de workspaces aún sin procesar (incluido este).
 * @returns Decisión: omitir o procesar con deadlineMs.
 */
export function decidirWorkspace(
  restanteMs: number,
  pendientes: number,
): { omitir: true } | { omitir: false; deadlineMs: number } {
  const MINIMO_PARA_INICIAR = 15_000;

  if (restanteMs < MINIMO_PARA_INICIAR) {
    return { omitir: true };
  }

  const deadlineMs = presupuestoPorWorkspace(restanteMs, pendientes);
  return { omitir: false, deadlineMs };
}
