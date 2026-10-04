/** Clave interna del módulo (admin + feature flag por workspace). */
export const WEBSITE_MODULE_KEY = "website";

/**
 * El blog no es un módulo: es una sección del Sitio web que sólo existe con al menos un
 * artículo publicado. Para el menú público igual se comporta como uno (una entrada en
 * `PUBLIC_MODULE_PAGES`), y esta es la llave con la que el armazón lo "habilita" — nunca se
 * guarda en `WorkspaceFeatureModule`, por eso no se parece a ninguna llave de módulo real.
 */
export const BLOG_PUBLIC_PAGE_KEY = "website:blog";
