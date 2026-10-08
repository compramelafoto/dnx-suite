/**
 * Dirección pública (FotofficeWorkspaceBranding.publicSlug) de DNX Estudio. Módulo PURO: lo usan
 * tanto el servidor como pruebas y módulos de datos. Es la ÚNICA copia del valor: todo lo que
 * distingue a DNX (semillas de circuitos, categorías de notas, catálogos de consultas, campos,
 * plantillas, catálogo de productos, ajustes de presupuestos) pregunta con `esSlugDnx`.
 */
export const SLUG_DNX = "dnxestudio";

/** Valor viejo que figuraba en el código (nunca existió en producción); se sigue aceptando. */
export const SLUG_DNX_HISTORICO = "dnx-estudio";

/** Todas las direcciones que se reconocen como DNX Estudio, la real primero. */
export const SLUGS_DNX: readonly string[] = [SLUG_DNX, SLUG_DNX_HISTORICO];

/** ¿Esta dirección pública es la de DNX Estudio? */
export function esSlugDnx(slug: string | null | undefined): boolean {
  return typeof slug === "string" && SLUGS_DNX.includes(slug.trim().toLowerCase());
}
