/** Misma clave que `WorkspaceFeatureModule.moduleKey`. */
export const PORTFOLIO_MODULE_KEY = "portfolio";

/**
 * Tope de fotos por socio. Se valida en el servidor: un tope que sólo vive en el botón no es
 * un tope.
 */
export const PORTFOLIO_MAX_PHOTOS = 20;

/**
 * Cargos vencidos impagos a partir de los cuales el portfolio deja de mostrarse.
 *
 * Es una aproximación de la regla del estatuto (3 cuotas SEGUIDAS, o 5 alternadas dentro de
 * una ventana de 24 meses), que todavía no está calculada en ningún lado: los tres umbrales
 * existen en `MembershipDuesSettings` y ningún código los lee. Cuando ese cálculo exista se
 * cambia la condición dentro de `portfolioVisibility`, y nada más.
 */
export const PORTFOLIO_OVERDUE_LIMIT = 3;

/**
 * Segmento bajo `/w/[slug]/`. Fijo a propósito: si siguiera al vocabulario del workspace,
 * cambiar una palabra en Configuración rompería todos los enlaces ya publicados.
 */
export const PORTFOLIO_PUBLIC_SEGMENT = "socios";
