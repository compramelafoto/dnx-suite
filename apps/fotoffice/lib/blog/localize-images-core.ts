/** Un nodo del documento del editor (TipTap), lo justo para recorrerlo. */
export type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  [k: string]: unknown;
};

/**
 * Lo puro de la copia de imágenes del blog: qué imagen es "de afuera" y cómo se reemplaza en el
 * contenido del editor. Sin red ni base, para poder probarlo.
 */

/**
 * Sólo se copian imágenes de sitios conocidos: el CDN de Alboom (de donde vienen los blogs que
 * se migran) y FotoRank. Bajar cualquier dirección que aparezca en un artículo convertiría al
 * servidor en un descargador de lo que alguien escriba.
 */
export const externalImageHosts = ["cdn.alboompro.com", "fotorank.dnxsuite.com", "fotorank.com", "www.fotorank.com"];

export function isExternalBlogImage(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && externalImageHosts.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Todas las `src` de imágenes del documento, en orden. */
export function collectImageSources(doc: JSONContent | null | undefined): string[] {
  const out: string[] = [];
  const visitar = (n: JSONContent | undefined) => {
    if (!n) return;
    if (n.type === "image" && typeof n.attrs?.src === "string") out.push(n.attrs.src);
    n.content?.forEach(visitar);
  };
  visitar(doc ?? undefined);
  return out;
}

/** Copia del documento con las `src` reemplazadas. No toca el original. */
export function replaceImageSources(doc: JSONContent, reemplazos: ReadonlyMap<string, string>): JSONContent {
  const visitar = (n: JSONContent): JSONContent => {
    const src = n.type === "image" && typeof n.attrs?.src === "string" ? n.attrs.src : null;
    return {
      ...n,
      ...(src && reemplazos.has(src) ? { attrs: { ...n.attrs, src: reemplazos.get(src) } } : {}),
      ...(n.content ? { content: n.content.map(visitar) } : {}),
    };
  };
  return visitar(doc);
}
