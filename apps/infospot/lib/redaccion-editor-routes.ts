/**
 * Editor routes that use the focused Redacción chrome
 * (no SiteHeader/SiteFooter; shell focus mode).
 */
const EDITOR_PATH_PATTERNS: RegExp[] = [
  /^\/redaccion\/nueva\/?$/,
  /^\/redaccion\/noticias\/[^/]+\/editar\/?$/,
  /^\/redaccion\/eventos\/nuevo\/?$/,
  /^\/redaccion\/eventos\/[^/]+\/editar\/?$/,
];

export function isRedaccionEditorPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return EDITOR_PATH_PATTERNS.some((re) => re.test(path));
}

export function redaccionEditorBackHref(pathname: string): string {
  if (pathname.startsWith("/redaccion/eventos")) {
    return "/redaccion/eventos";
  }
  return "/redaccion";
}

export function redaccionEditorBackLabel(pathname: string): string {
  if (pathname.startsWith("/redaccion/eventos")) {
    return "Volver a Eventos";
  }
  return "Volver a Redacción";
}
