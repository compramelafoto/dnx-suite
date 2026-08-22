/**
 * Destino del socio después de activar su acceso.
 *
 * Centralizado a propósito: cuando exista el módulo Pagos, `PORTAL_HOME` pasa a ser
 * `/portal/pagos` y no hay que salir a buscar redirecciones sueltas por el código.
 *
 * El destino NUNCA es `/workspace`. Esa ruta crea un workspace nuevo para quien no tiene
 * ninguno (`ensureFotofficeWorkspaceForUser`), así que mandar ahí a un socio le fabricaría
 * una institución propia de la que además quedaría dueño.
 */
export const PORTAL_HOME = "/portal";

/**
 * Valida un `next` recibido del navegador y devuelve una ruta interna segura.
 *
 * Doble restricción: tiene que ser una ruta interna (nada de esquemas ni `//`) Y tiene que
 * caer dentro del portal. Lo segundo no es redundante — sin eso, un `next=/workspace`
 * perfectamente "interno" empujaría al socio al panel administrativo.
 */
export function resolvePortalDestination(next?: string | null): string {
  const value = next?.trim();
  if (!value) return PORTAL_HOME;

  // Cualquier control (saltos de línea incluidos) descalifica: no se sanea, se descarta.
  if (/[\u0000-\u001f\u007f]/.test(value)) return PORTAL_HOME;
  if (!value.startsWith("/") || value.startsWith("//")) return PORTAL_HOME;
  if (value.includes("..")) return PORTAL_HOME;

  // `/portalfalso` no es el portal: se exige el límite exacto del segmento.
  const path = value.split(/[?#]/)[0] ?? "";
  if (path !== PORTAL_HOME && !path.startsWith(`${PORTAL_HOME}/`)) return PORTAL_HOME;

  return value;
}
