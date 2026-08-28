/**
 * Preferencia de "menú visible / menú oculto" del panel administrativo.
 *
 * Va en cookie, no en `localStorage`, por una razón concreta: el layout es un componente de
 * servidor y lee la cookie ANTES de renderizar. Con `localStorage` habría que pintar el menú,
 * esperar a que el navegador ejecute el JavaScript y recién ahí esconderlo — el usuario vería
 * el menú aparecer y desaparecer en cada carga.
 *
 * No es un dato sensible: solo dice si el menú está desplegado. Por eso no lleva `HttpOnly`
 * (el botón la escribe desde el navegador) ni `Secure` (rompería en desarrollo local).
 */

export const SHELL_NAV_COOKIE = "fo_nav";

/** Un año: es una preferencia de comodidad, no tiene por qué caducar sola. */
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export type ShellNavPreference = "open" | "hidden";

/**
 * Cualquier valor que no sea exactamente `"hidden"` cuenta como menú visible.
 *
 * El sesgo es deliberado: ante una cookie ausente, vieja o manipulada, la falla debe ser
 * "se ve el menú". Fallar al revés dejaría a alguien sin navegación y sin saber por qué.
 */
export function parseShellNavPreference(value: string | null | undefined): ShellNavPreference {
  return value === "hidden" ? "hidden" : "open";
}

/** Cadena lista para asignar a `document.cookie` desde el botón del menú. */
export function serializeShellNavCookie(preference: ShellNavPreference): string {
  return `${SHELL_NAV_COOKIE}=${preference}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}
