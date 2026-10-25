/**
 * El editor (`/plantillas/v2/<plantilla>/<versión>`) ocupa toda la pantalla y no se desplaza.
 * `/plantillas/v2/<plantilla>/probar` tiene la misma forma pero es una página común, larga: si
 * cae en pantalla completa queda trabada sin poder bajar a los textos.
 */
export function isTemplateV2EditorPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const m = /^\/fotografo\/diseno\/plantillas\/v2\/[^/]+\/([^/]+)\/?$/.exec(pathname);
  return m !== null && m[1] !== "probar";
}
