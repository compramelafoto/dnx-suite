/** Clave interna del módulo (admin + feature flag por workspace). */
export const WEBSITE_MODULE_KEY = "website";

/**
 * El blog no es un módulo: es una sección del Sitio web que sólo existe con al menos un
 * artículo publicado. Para el menú público igual se comporta como uno (una entrada en
 * `PUBLIC_MODULE_PAGES`), y esta es la llave con la que el armazón lo "habilita" — nunca se
 * guarda en `WorkspaceFeatureModule`, por eso no se parece a ninguna llave de módulo real.
 */
export const BLOG_PUBLIC_PAGE_KEY = "website:blog";

/**
 * Trabajos (el portfolio del estudio) tampoco es un módulo: como el blog, es una sección del
 * Sitio web que entra al menú sólo con al menos un trabajo publicado. Misma idea de llave propia.
 */
export const TRABAJOS_PUBLIC_PAGE_KEY = "website:trabajos";

/** Segmento de Trabajos bajo `/w/[slug]/`. */
export const TRABAJOS_PUBLIC_SEGMENT = "trabajos";

/**
 * Testimonios tampoco es un módulo: es una sección del Sitio web que entra al menú sólo con al menos
 * un testimonio publicado. Misma idea de llave propia que el blog y Trabajos.
 */
export const TESTIMONIOS_PUBLIC_PAGE_KEY = "website:testimonios";

/** Segmento de la lista de testimonios bajo `/w/[slug]/`. */
export const TESTIMONIOS_PUBLIC_SEGMENT = "testimonios";

/** Segmento del formulario abierto para dejar un testimonio bajo `/w/[slug]/`. */
export const TESTIMONIO_FORM_SEGMENT = "testimonio";

/** Segmento de la página Institucional (la comisión directiva) bajo `/w/[slug]/`. */
export const INSTITUTIONAL_PUBLIC_SEGMENT = "institucional";

/** Nombre de la página `/presupuesto` (formulario de presupuesto) en el menú y título del formulario. */
export const PRESUPUESTO_PAGE_LABEL = "Pedí tu presupuesto";
