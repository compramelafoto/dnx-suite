import { atributo, buscar, buscarTodos, parsearHtml } from "./dom";

/**
 * Los listados del sitio de Alboom: qué trabajos, galerías y páginas existen.
 *
 * - `/portfolio` muestra 12 trabajos y un botón «Mostrar más» (`#loadMore`, con `data-pages`). Las
 *   páginas siguientes llegan por AJAX (`/portfolio?page=N` con `X-Requested-With`; sin ese
 *   encabezado Alboom responde 403) y traen sólo las tarjetas.
 * - `/galerias` lista las galerías (`/gallery/<id>-<slug>`).
 * - `/sitemap.xml` tiene todas las páginas propias y landings en línea.
 */

const RUTA_TRABAJO = /^\/portfolio\/([a-z0-9_-]+)\/(\d+)-[^/?#]*$/i;
const RUTA_GALERIA = /^\/gallery\/(\d+)-[^/?#]*$/i;

/** Ruta del sitio (`/portfolio/x/1-y`) de un `href` relativo o absoluto del mismo sitio. */
function rutaPropia(href: string | null): string | null {
  if (!href) return null;
  const v = href.trim().replace(/&amp;/g, "&");
  if (v.startsWith("/")) return v.split(/[?#]/)[0];
  try {
    const u = new URL(v);
    return /^(?:www\.)?dnxfotografia\.com\.ar$/i.test(u.hostname) ? u.pathname : null;
  } catch {
    return null;
  }
}

function rutasQueCumplen(html: string, patron: RegExp): string[] {
  const out: string[] = [];
  for (const a of buscarTodos(parsearHtml(html), "a")) {
    const ruta = rutaPropia(atributo(a, "href"));
    if (ruta && patron.test(ruta) && !out.includes(ruta)) out.push(ruta);
  }
  return out;
}

/** Una página del listado de trabajos: las rutas de los trabajos y cuántas páginas hay en total. */
export function leerListadoTrabajos(html: string): { rutas: string[]; paginas: number } {
  const boton = buscar(parsearHtml(html), "#loadMore");
  const paginas = Number(atributo(boton, "data-pages") ?? "1");
  return { rutas: rutasQueCumplen(html, RUTA_TRABAJO), paginas: Number.isInteger(paginas) && paginas > 0 && paginas < 100 ? paginas : 1 };
}

/** Las rutas de las galerías (`/gallery/<id>-<slug>`). */
export function leerListadoGalerias(html: string): string[] {
  return rutasQueCumplen(html, RUTA_GALERIA);
}

/** Los trabajos que enlaza la portada, en orden (los que Daniel eligió mostrar: van al carrusel). */
export function leerTrabajosDeLaPortada(html: string): string[] {
  return rutasQueCumplen(html, RUTA_TRABAJO);
}

/** Las rutas del `sitemap.xml` (sin dominio), en orden. */
export function leerSitemap(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const ruta = rutaPropia(m[1].replace(/&amp;/g, "&"));
    if (ruta && !out.includes(ruta)) out.push(ruta);
  }
  return out;
}

/** Número de Alboom de una ruta de trabajo o galería (`/portfolio/books/1465286-x` → `1465286`). */
export function idDeRuta(ruta: string): string | null {
  return RUTA_TRABAJO.exec(ruta)?.[2] ?? RUTA_GALERIA.exec(ruta)?.[1] ?? null;
}
