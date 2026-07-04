/**
 * `getAuthUser` en `@/lib/auth` ya realiza lectura dual (dnx_session → UserSession, luego auth-token).
 * Reexport para código que importaba el bridge sin duplicar lógica.
 */
export { getAuthUser } from "./auth";
