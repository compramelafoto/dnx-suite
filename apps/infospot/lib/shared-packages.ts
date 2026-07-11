/**
 * Paquetes compartidos usados por Info Spot:
 * - @repo/db — modelos InfoSpot* + helpers de permisos
 * - @repo/auth — sesión DNX (`dnx_session`)
 * - @repo/design-system — UI/tokens (tema Info Spot pendiente)
 *
 * Roles editoriales viven en `InfoSpotUserRole` (no en SuiteAppRole).
 * ComprameLaFoto NO debe importar esta app.
 */

export const INFOSPOT_APP_NAME = "infospot" as const;
