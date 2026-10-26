import { atributo, buscar, buscarTodos, htmlInterno, parsearHtml, textoDe, type Elemento } from "./dom";
import { mejorUrlDeImagen } from "./fotos";

/**
 * Un artículo del blog de Alboom (`/post/<id>-<slug>` o `/post.php?id=<id>`).
 *
 * La fecha viene como «27/01/2024 às 19:36» y es hora argentina: se devuelve tal cual, como
 * `aaaa-mm-ddThh:mm` sin zona; pasarla a UTC (+3 h) es trabajo de quien la guarda.
 */
export type ArticuloAlboom = {
  alboomId: string;
  /** Slug de Alboom sin el número (sale de la dirección canónica). Vacío si no se pudo leer. */
  slugAlboom: string;
  titulo: string;
  fechaLocal: string;
  categorias: string[];
  portadaUrl: string | null;
  /** HTML de `.post_content`, tal cual (sin sanear). */
  cuerpoHtml: string;
};

/** La dirección canónica de la página (o, si no tiene, la de `og:url`). */
export function urlCanonica(raiz: Elemento): string | null {
  return atributo(buscar(raiz, `link[rel="canonical"]`), "href") ?? atributo(buscar(raiz, `meta[property="og:url"]`), "content");
}

/** «27/01/2024 às 19:36» (o «27/01/2024») → «2024-01-27T19:36». Null si no tiene esa forma. */
export function fechaAlboomALocal(texto: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/.exec(texto);
  if (!m) return null;
  const [, d, mes, a, h = "0", min = "00"] = m;
  const dos = (v: string) => v.padStart(2, "0");
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23) return null;
  return `${a}-${dos(mes)}-${dos(d)}T${dos(h)}:${min}`;
}

function idDelArticulo(url: string, raiz: Elemento): string | null {
  const deUrl = /\/post\/(\d+)-/.exec(url) ?? /[?&]id(?:_post)?=(\d+)/.exec(url);
  if (deUrl) return deUrl[1];
  // La canónica del artículo no lleva el número; el botón de «me gusta» sí.
  const like = atributo(buscar(raiz, "[data-like-url]"), "data-like-url");
  return like ? (/id_post=(\d+)/.exec(like)?.[1] ?? null) : null;
}

function slugDe(url: string | null): string {
  if (!url) return "";
  const m = /\/post\/(?:\d+-)?([^/?#]+)/.exec(url);
  return m ? m[1].toLowerCase() : "";
}

export function leerArticulo(html: string, url: string): ArticuloAlboom {
  const raiz = parsearHtml(html);
  const cabecera = buscar(raiz, ".post_header");
  const alboomId = idDelArticulo(url, raiz);
  if (!alboomId) throw new Error(`No se encontró el número del artículo en ${url}`);
  const titulo = textoDe(buscar(raiz, "h1.ac__title"));
  if (!titulo) throw new Error(`El artículo ${alboomId} no tiene título`);
  const textoFecha = textoDe(buscar(cabecera, ".publish-date"));
  const fechaLocal = fechaAlboomALocal(textoFecha);
  if (!fechaLocal) throw new Error(`El artículo ${alboomId} no tiene una fecha legible («${textoFecha}»)`);

  const categorias = buscarTodos(cabecera, ".date-categories .category-item")
    .map((c) => textoDe(c))
    .filter(Boolean);
  const imgPortada = buscar(raiz, ".post_cover img");
  const contenido = buscar(raiz, ".post_content");

  return {
    alboomId,
    slugAlboom: slugDe(urlCanonica(raiz)) || slugDe(url),
    titulo,
    fechaLocal,
    categorias: [...new Set(categorias)],
    portadaUrl: imgPortada ? mejorUrlDeImagen(imgPortada) : null,
    cuerpoHtml: htmlInterno(contenido, html).trim(),
  };
}
