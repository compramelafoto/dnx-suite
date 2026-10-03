/**
 * Las redes del fotógrafo, convertidas en direcciones que se pueden abrir.
 *
 * ── Por qué no alcanza con lo guardado ──
 *
 * Instagram y TikTok se guardan como usuario, sin arroba (`juanfoto`); el sitio, Facebook, YouTube
 * y LinkedIn como dirección, que puede venir sin `https://`. Ninguna de las dos formas sirve tal
 * cual: ni para un `href` ni para el `sameAs` de los datos estructurados, que exige direcciones
 * absolutas. Un `sameAs: ["juanfoto"]` Google lo descarta en silencio.
 *
 * ── Por qué está acá y no dentro del componente ──
 *
 * Lo usan la ficha (los botones que ve la persona) y el JSON-LD (lo que lee Google). Si cada uno
 * armara su versión, un día dirían cosas distintas sobre el mismo fotógrafo. Es la misma razón por
 * la que la extracción de las fotos de Alboom dejó de vivir suelta dentro de un guion.
 */

export type PortfolioLinks = {
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
};

export type RedEtiqueta = "Sitio" | "Instagram" | "TikTok" | "Facebook" | "YouTube" | "LinkedIn";

/** Quien escribió "miestudio.com" sin `https://` igual tiene que terminar en su sitio. */
export function normalizarUrl(valor: string): string {
  const limpio = valor.trim();
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** Acepta "@usuario", "usuario" o la dirección completa pegada en el campo. */
export function limpiarUsuario(valor: string): string {
  return valor
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

/**
 * Cada red cargada, con su etiqueta y su dirección absoluta, en orden de importancia.
 *
 * Se saltean los valores que quedan vacíos después de limpiarlos: un campo con sólo un arroba o
 * unos espacios produciría un enlace a la portada de Instagram, que no es el perfil de nadie.
 */
export function enlacesDeRedes(links: PortfolioLinks): { etiqueta: RedEtiqueta; href: string }[] {
  const items: { etiqueta: RedEtiqueta; href: string }[] = [];

  if (links.website?.trim()) items.push({ etiqueta: "Sitio", href: normalizarUrl(links.website) });

  const ig = links.instagram ? limpiarUsuario(links.instagram) : "";
  if (ig) items.push({ etiqueta: "Instagram", href: `https://instagram.com/${ig}` });

  const tt = links.tiktok ? limpiarUsuario(links.tiktok) : "";
  if (tt) items.push({ etiqueta: "TikTok", href: `https://tiktok.com/@${tt}` });

  if (links.facebook?.trim()) items.push({ etiqueta: "Facebook", href: normalizarUrl(links.facebook) });
  if (links.youtube?.trim()) items.push({ etiqueta: "YouTube", href: normalizarUrl(links.youtube) });
  if (links.linkedin?.trim()) items.push({ etiqueta: "LinkedIn", href: normalizarUrl(links.linkedin) });

  return items;
}

/** Sólo las direcciones, para el `sameAs` de schema.org. */
export function urlsDeRedes(links: PortfolioLinks): string[] {
  return enlacesDeRedes(links).map((i) => i.href);
}
