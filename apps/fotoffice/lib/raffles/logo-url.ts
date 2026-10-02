/**
 * La dirección desde la que se muestra el logo de un aliado. PURO.
 *
 * Las fichas viven en DNX Partners y sus logos en un bucket privado, que Clickatón sirve por
 * su propio proxy `/api/media/<key>`. Esa dirección es RELATIVA: si FotOffice la usa tal cual,
 * le pide la imagen a su propio servidor, que no la tiene, y el socio ve un recuadro roto.
 *
 * Cuando el bucket está publicado, en cambio, la ficha guarda una dirección completa y no hay
 * nada que resolver.
 *
 * Ante la duda, devuelve `null`: una tarjeta de premio sin logo se ve bien; una con la imagen
 * rota se ve descuidada.
 */
export function resolveLogoUrl(
  logoUrl: string | null | undefined,
  partnersBaseUrl: string | null | undefined,
): string | null {
  const valor = logoUrl?.trim();
  if (!valor) return null;

  if (/^https?:\/\//i.test(valor)) return valor;

  // Sólo se completa una ruta del sitio. Cualquier otra cosa —`javascript:`, `data:`— no es
  // un logo, es algo que alguien escribió donde no debía.
  if (!valor.startsWith("/")) return null;

  const base = partnersBaseUrl?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}${valor}`;
}
