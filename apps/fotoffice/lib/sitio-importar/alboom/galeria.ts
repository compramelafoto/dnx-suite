import { urlCanonica } from "./articulo";
import { atributo, buscar, buscarTodos, parsearHtml, textoDe } from "./dom";
import { esUrlDeFoto, unicas, urlOriginal } from "./fotos";

/**
 * Una galería de Alboom (`/gallery/<id>-<slug>`): sólo título y fotos. Cada foto es un enlace a la
 * original (`a.cgci__link`); los videos llevan `data-is-video="true"` y su enlace es el video.
 */
export type GaleriaAlboom = {
  alboomId: string;
  slugAlboom: string;
  titulo: string;
  fotos: string[];
  videos: string[];
};

const RUTA = /\/gallery\/(\d+)-([^/?#]+)/;

export function leerGaleria(html: string, url: string): GaleriaAlboom {
  const raiz = parsearHtml(html);
  const ruta = RUTA.exec(url) ?? RUTA.exec(urlCanonica(raiz) ?? "");
  if (!ruta) throw new Error(`No se encontró el número de la galería en ${url}`);
  const titulo = textoDe(buscar(raiz, "h1.cg__title"));
  if (!titulo) throw new Error(`La galería ${ruta[1]} no tiene título`);

  const enlaces = buscarTodos(raiz, "a.cgci__link");
  const fotos: string[] = [];
  const videos: string[] = [];
  for (const a of enlaces) {
    const href = atributo(a, "href");
    if (!esUrlDeFoto(href)) continue;
    if (atributo(a, "data-is-video") === "true") videos.push(href.trim());
    else fotos.push(urlOriginal(href));
  }
  return { alboomId: ruta[1], slugAlboom: ruta[2].toLowerCase(), titulo, fotos: unicas(fotos), videos: unicas(videos) };
}
