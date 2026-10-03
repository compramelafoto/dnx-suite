/**
 * Qué transición de estado exige coordinar, y cuál alcanza con revisar.
 *
 * `RECIBIDA → EN_EVALUACION` es empezar a mirar la carpeta: trabajo de secretaría que no
 * compromete nada. Cualquier otro destino —aprobar, rechazar, cerrar, cancelar— compromete el
 * tiempo de voluntarios y la palabra de la institución frente a quien pidió la cobertura, así
 * que exige coordinar. Por eso el guard de cada acción no es fijo: depende de a dónde va la
 * solicitud, no de qué acción del formulario se apretó.
 */
export function transitionNeedsCoordinator(to: string): boolean {
  return to !== "EN_EVALUACION";
}
