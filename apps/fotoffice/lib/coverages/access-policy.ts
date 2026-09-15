/**
 * Quién puede qué en el módulo, en esta etapa.
 *
 * Dos niveles, misma doctrina que el módulo Socios: no se inventan roles granulares
 * (secretario, tesorero) porque FotoOffice todavía no los tiene, y tenerlos solo acá los
 * volvería incomparables con el resto del panel.
 *
 * `ADMIN` se acepta además del enum nuevo porque otros callers del panel todavía pasan roles
 * de la tabla `Membership` vieja.
 */
const COORDINAN = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]);

export function canCoordinateCoverages(role: string | null | undefined): boolean {
  return typeof role === "string" && COORDINAN.has(role);
}

/** Revisar es leer la bandeja, anotar y pedir información. No aprueba ni asigna. */
export function canReviewCoverages(role: string | null | undefined): boolean {
  return canCoordinateCoverages(role) || role === "STAFF";
}

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
