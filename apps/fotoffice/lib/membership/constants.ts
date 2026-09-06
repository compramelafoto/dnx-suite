/**
 * Clave interna del módulo de cuotas societarias (admin + feature flag por workspace).
 * Mismo patrón que members/courses-sales/evaluaciones.
 *
 * Estuvo escrita a mano en dos archivos —el registro de módulos y el menú del portal— y
 * eso es justamente lo que dejó la sección inalcanzable: el registro la declaraba
 * `PLANNED` y el menú la exigía habilitada, sin que nada obligara a mirar las dos juntas.
 */
export const MEMBERSHIP_DUES_MODULE_KEY = "membership-dues";
