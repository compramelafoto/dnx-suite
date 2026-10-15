/**
 * Constantes de Proyectos (Etapa 4, Entrega A). Módulo PURO: sin acceso a la base.
 */

/** Plantilla de nombre por omisión de un proyecto. */
export const PLANTILLA_NOMBRE_POR_OMISION = "{contacto} · {producto}";

/** Variables que admite la plantilla de nombre. */
export const VARIABLES_NOMBRE = ["contacto", "producto", "evento", "pedido"] as const;
export type VariableNombre = (typeof VARIABLES_NOMBRE)[number];

/** Largo máximo del nombre de un proyecto (y de la plantilla). */
export const LARGO_MAXIMO_NOMBRE = 200;

/** Rango de días desde el evento de una regla (igual que el CHECK del SQL). */
export const DIAS_DESDE_EVENTO_MIN = -365;
export const DIAS_DESDE_EVENTO_MAX = 365;

/** Hasta dónde se baja dentro de combos anidados (el catálogo no tiene ciclos; es un resguardo). */
export const PROFUNDIDAD_MAXIMA_COMBOS = 10;

/** Huso horario de todas las fechas de proyectos. */
export const HUSO_HORARIO = "America/Argentina/Buenos_Aires";
