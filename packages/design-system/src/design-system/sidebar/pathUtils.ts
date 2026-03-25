/**
 * Determina si la ruta actual corresponde al `href` del ítem.
 * Por defecto: prefijo (útil para subrutas). Pasar `exact: true` para igualdad estricta.
 */
export function isSidebarPathActive(
  pathname: string,
  href: string,
  options?: { exact?: boolean },
): boolean {
  const p = (pathname.replace(/\/$/, "") || "/") as string;
  const h = (href.replace(/\/$/, "") || "/") as string;
  if (options?.exact) return p === h;
  return p === h || p.startsWith(`${h}/`);
}
