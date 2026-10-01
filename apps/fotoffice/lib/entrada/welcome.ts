/**
 * A dónde va quien inicia sesión y FotoOffice no sabe quién es.
 *
 * Antes ese camino terminaba en `ensureFotofficeWorkspaceForUser`, que le creaba una
 * institución con esa persona de dueña. Ahora termina en una pregunta.
 *
 * Vive en su propio módulo —y no junto a `resolvePortalDestination`— porque lo importan
 * tanto rutas del panel como del portal, y porque la barrera que impide volver al camino
 * viejo (`lib/entrada/sin-institucion-fantasma.test.ts`) necesita poder leerlo sin arrastrar
 * Prisma.
 */
export const WELCOME_PATH = "/bienvenida";
