import { parseContentHtmlToJson } from "@repo/content";
import { createEmptyBlock, EMBED_MAX_HEIGHT_PX, websiteBlockSchema, type WebsiteBlock } from "@/lib/website/blocks";
import { isAllowedEmbedUrl, toVideoEmbedUrl } from "@/lib/website/embed-hosts";
import { sanitizeRichTextConfig } from "@/lib/website/rich-text-sanitize";
import { atributo, buscarTodos, parsearHtml } from "./alboom/dom";
import type { PaginaAlboom, SeccionAlboom } from "./alboom/pagina";

/**
 * Del HTML de Alboom al contenido de FOTOFFICE: el cuerpo de un artículo pasa al documento del
 * editor del blog (TipTap) y una página pasa a bloques del sitio. Puro: sin red ni base.
 *
 * Los enlaces al sitio viejo (`dnxfotografia.com.ar/...`) se reescriben con `mapaEnlaces`, que
 * arma quien carga (artículos y trabajos ya importados → su ruta nueva). Las claves son rutas
 * normalizadas con `normalizarRutaVieja`; un enlace que no está en el mapa queda como estaba, y lo
 * resuelven las redirecciones del sitio cuando el dominio pase a FOTOFFICE.
 */
export type MapaEnlaces = ReadonlyMap<string, string>;

/** Documento del editor del blog (el tipo de TipTap, sin importar TipTap acá). */
export type JSONContent = Awaited<ReturnType<typeof parseContentHtmlToJson>>;

const HOST_VIEJO = /^(?:www\.)?dnxfotografia\.com\.ar$/i;

/**
 * Ruta de una dirección del sitio viejo en la forma que usan las claves de `mapaEnlaces`:
 * minúsculas, sin barra final (salvo `/`), y la consulta sólo para `post.php` / `album.php`
 * (`/post.php?id=89987`). Null si la dirección no es del sitio viejo.
 */
export function normalizarRutaVieja(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !HOST_VIEJO.test(u.hostname)) return null;
  let ruta: string;
  try {
    ruta = decodeURIComponent(u.pathname);
  } catch {
    ruta = u.pathname;
  }
  ruta = ruta.toLowerCase().replace(/\/+$/, "") || "/";
  if (ruta === "/post.php" || ruta === "/album.php") {
    const id = u.searchParams.get("id");
    return id && /^\d+$/.test(id) ? `${ruta}?id=${id}` : ruta;
  }
  return ruta;
}

/**
 * Dirección nueva para un enlace. Prueba la ruta exacta y, para artículos y trabajos, también la
 * forma por número (`/post/89987-x` → `/post.php?id=89987`; `/portfolio/fiestas/375817-x` →
 * `/album.php?id=375817`), así alcanza con cargar el mapa por número.
 */
export function reescribirEnlace(href: string, mapa: MapaEnlaces): string {
  const ruta = normalizarRutaVieja(href);
  if (!ruta) return href;
  const directo = mapa.get(ruta);
  if (directo) return directo;
  const post = /^\/post\/(\d+)(?:-|$)/.exec(ruta);
  if (post) return mapa.get(`/post.php?id=${post[1]}`) ?? href;
  const trabajo = /^\/portfolio\/[^/]+\/(\d+)(?:-|$)/.exec(ruta) ?? /^\/gallery\/(\d+)(?:-|$)/.exec(ruta);
  if (trabajo) return mapa.get(`/album.php?id=${trabajo[1]}`) ?? href;
  return href;
}

function escaparAtributo(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Los `href` del HTML, reescritos con el mapa. */
function reescribirEnlacesHtml(html: string, mapa: MapaEnlaces): string {
  if (mapa.size === 0) return html;
  return html.replace(/(\shref\s*=\s*)(["'])(.*?)\2/gi, (entero, antes: string, comilla: string, valor: string) => {
    const nuevo = reescribirEnlace(valor.replace(/&amp;/g, "&"), mapa);
    return nuevo === valor.replace(/&amp;/g, "&") ? entero : `${antes}${comilla}${escaparAtributo(nuevo)}${comilla}`;
  });
}

/** Marca que reemplaza a cada video mientras se parsea (ver `prepararParaElEditor`). */
const MARCA_VIDEO = (n: number) => `@@video-alboom-${n}@@`;

/**
 * Prepara el HTML de Alboom para el parser del editor: los `<h1>` del cuerpo bajan a `<h2>` (el
 * título del artículo es el único H1 y el editor no los admite) y cada iframe de YouTube se cambia
 * por un párrafo con una marca, que después se reemplaza por el nodo `youtube`. El parser del
 * servidor (zeed-dom) no entiende el selector con el que la extensión de YouTube reconoce sus
 * iframes (`div[data-youtube-video] iframe`), así que con el HTML tal cual el video se perdía.
 */
function prepararParaElEditor(html: string): { html: string; videos: string[] } {
  let out = html.replace(/<(\/?)h1(\s[^>]*)?>/gi, "<$1h2>");
  const videos: string[] = [];
  out = out.replace(/<iframe\b([^>]*)>(?:[\s\S]*?<\/iframe>)?/gi, (entero, attrs: string) => {
    const src = atributo(buscarTodos(parsearHtml(`<iframe${attrs}>`), "iframe")[0], "src") ?? "";
    const embed = toVideoEmbedUrl(src.startsWith("//") ? `https:${src}` : src);
    if (!embed?.startsWith("https://www.youtube.com/embed/")) return entero;
    videos.push(embed);
    return `<p>${MARCA_VIDEO(videos.length - 1)}</p>`;
  });
  return { html: out, videos };
}

/** Cambia los párrafos-marca por nodos `youtube` (con los mismos atributos que pone el editor). */
function ponerVideos(n: JSONContent, videos: string[]): JSONContent {
  if (!n.content) return n;
  const content = n.content.map((h) => {
    const unico = h.type === "paragraph" && h.content?.length === 1 ? h.content[0] : null;
    const m = unico?.type === "text" ? /^@@video-alboom-(\d+)@@$/.exec((unico.text ?? "").trim()) : null;
    if (m && videos[Number(m[1])]) return { type: "youtube", attrs: { src: videos[Number(m[1])], start: 0, width: 640, height: 360 } };
    return ponerVideos(h, videos);
  });
  return { ...n, content };
}

function esParrafoVacio(n: JSONContent): boolean {
  if (n.type !== "paragraph") return false;
  return (n.content ?? []).every((h) => h.type === "hardBreak" || (h.type === "text" && !(h.text ?? "").replace(/[\s ]/g, "")));
}

function reescribirEnlacesJson(n: JSONContent, mapa: MapaEnlaces): JSONContent {
  const marks = n.marks?.map((m) =>
    m.type === "link" && typeof m.attrs?.href === "string" ? { ...m, attrs: { ...m.attrs, href: reescribirEnlace(m.attrs.href, mapa) } } : m,
  );
  return {
    ...n,
    ...(marks ? { marks } : {}),
    ...(n.content ? { content: n.content.map((h) => reescribirEnlacesJson(h, mapa)) } : {}),
  };
}

/** Cuerpo de un artículo de Alboom → documento del editor del blog. */
export async function htmlArticuloAContenido(html: string, mapaEnlaces: MapaEnlaces = new Map()): Promise<JSONContent> {
  const preparado = prepararParaElEditor(html);
  const parseado = await parseContentHtmlToJson(preparado.html);
  const doc = reescribirEnlacesJson(ponerVideos(parseado, preparado.videos), mapaEnlaces);
  // Los párrafos vacíos del final (Alboom deja varios `<p><br></p>`) no aportan nada.
  const content = [...(doc.content ?? [])];
  while (content.length > 1 && esParrafoVacio(content[content.length - 1])) content.pop();
  return { ...doc, content };
}

// ---------------------------------------------------------------------------------------------
// Páginas → bloques

const ALTO_EMBED_PX = Math.min(800, EMBED_MAX_HEIGHT_PX);

const corta = (v: string | undefined, max: number) => (v ? v.slice(0, max) : undefined);

/** Saca los párrafos que quedaron vacíos después de sanear (Alboom los usa como espacio). */
function sinParrafosVacios(html: string): string {
  const vacio = /<p>(?:\s|&nbsp;| |<br\s*\/?>|<span>(?:\s|&nbsp;| |<br\s*\/?>)*<\/span>)*<\/p>/gi;
  return html.replace(vacio, "").trim();
}

function textoPlano(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;| |\s/g, "");
}

export type OpcionesBloques = {
  mapaEnlaces?: MapaEnlaces;
  /** Prefijo de los ids de los bloques (`<prefijo>_<n>`). Por omisión `alboom`. */
  prefijoId?: string;
};

/**
 * Página de Alboom → bloques del sitio, en el orden de la página. Por sección: texto con formato
 * (título + textos), las fotos (galería si son 3 o más; si no, una imagen cada una), los iframes
 * (video si es YouTube o Vimeo; contenido insertado si el host está permitido; si no, se descarta),
 * un botón por cada botón, y el formulario de Alboom pasa a ser el formulario de presupuesto.
 */
export function paginaABloques(pagina: PaginaAlboom, opciones: OpcionesBloques = {}): WebsiteBlock[] {
  const mapa = opciones.mapaEnlaces ?? new Map<string, string>();
  const prefijo = opciones.prefijoId ?? "alboom";
  const bloques: WebsiteBlock[] = [];
  const agregar = (tipo: WebsiteBlock["type"], config: Record<string, unknown>) => {
    const base = createEmptyBlock(tipo, bloques.length);
    bloques.push(websiteBlockSchema.parse({ ...base, id: `${prefijo}_${bloques.length}`, config: { ...base.config, ...config } }));
  };

  const agregarIframe = (url: string, titulo?: string) => {
    if (toVideoEmbedUrl(url)) agregar("VIDEO", { title: corta(titulo, 200), url });
    else if (isAllowedEmbedUrl(url)) agregar("EMBED", { title: corta(titulo, 200), url, heightPx: ALTO_EMBED_PX });
  };

  const iframesVistos = new Set<string>();
  for (const s of pagina.secciones) agregarSeccion(s);
  for (const url of pagina.iframes) if (!iframesVistos.has(url)) agregarIframe(url);
  return bloques;

  function agregarSeccion(s: SeccionAlboom) {
    const htmlLimpio = s.html ? sinParrafosVacios(sanitizeRichTextConfig({ html: reescribirEnlacesHtml(s.html, mapa) }).html) : "";
    const hayTexto = textoPlano(htmlLimpio).length > 0;
    // Una sección que es sólo un título y un formulario: el título va en el formulario.
    const tituloAlFormulario = s.formulario && !hayTexto;
    if (hayTexto || (s.titulo && !tituloAlFormulario)) {
      agregar("RICH_TEXT", {
        title: corta(s.titulo, 200),
        html: htmlLimpio.slice(0, 100000),
        align: /text-align:\s*center/i.test(s.html) ? "center" : "left",
        width: "normal",
      });
    }
    if (s.imagenes.length >= 3) {
      agregar("GALLERY", {
        photos: s.imagenes.slice(0, 200).map((url, i) => ({ id: `${prefijo}_${bloques.length}_f${i}`, url })),
        layout: "grid",
        columns: 3,
        lightbox: true,
      });
    } else {
      for (const url of s.imagenes) agregar("IMAGE", { imageUrl: url, alt: corta(s.titulo, 300), widthPreset: "contained" });
    }
    for (const url of s.iframes) {
      iframesVistos.add(url);
      agregarIframe(url, s.titulo);
    }
    for (const b of s.botones) {
      agregar("CTA", { buttonLabel: corta(b.texto, 60), buttonUrl: reescribirEnlace(b.url, mapa).slice(0, 2000), stylePreset: "solid" });
    }
    if (s.formulario) agregar("INQUIRY_FORM", tituloAlFormulario && s.titulo ? { title: corta(s.titulo, 200) } : {});
  }
}
