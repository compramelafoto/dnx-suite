/**
 * Constantes del módulo Solicitudes y Coberturas.
 *
 * La clave es `coverages` y no `jobs` ni `requests` para no confundirlo con dos vecinos:
 * `work-orders`, que custodia un objeto ajeno y cobra, y `events`, reservado para eventos con
 * inscripción. Son tres cosas distintas y el nombre tiene que decirlo.
 */
export const COVERAGES_MODULE_KEY = "coverages";

/** Todo lo que se le muestra a una persona se lee en esta zona. */
export const COVERAGES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Prefijo del código público. `SC-2026-0042`. */
export const PUBLIC_CODE_PREFIX = "SC";
