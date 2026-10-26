import { urlCanonica } from "./articulo";
import { atributo, buscar, buscarTodos, htmlInterno, parsearHtml, quitarParrafoEnvolvente, textoDe, type Elemento } from "./dom";
import { esUrlDeFoto, mejorUrlDeImagen, unicas, urlOriginal } from "./fotos";

/**
 * Un trabajo del portfolio de Alboom (`/portfolio/<categoría>/<id>-<slug>`, también conocido como
 * `/album.php?id=<id>`). Las fotos salen en el orden de la página y como originales.
 */
export type TrabajoAlboom = {
  alboomId: string;
  categoriaSlug: string;
  /** Nombre de la categoría como se ve en la página («Books!»). */
  categoriaNombre: string | null;
  slugAlboom: string;
  titulo: string;
  lugar: string | null;
  /** Día del trabajo (`aaaa-mm-dd`) o null si la página no lo muestra. */
  fecha: string | null;
  /** HTML de la descripción, tal cual (sin sanear). */
  descripcionHtml: string;
  fotos: string[];
  /** Videos incrustados en el trabajo (dirección del iframe). */
  videos: string[];
};

const RUTA = /\/portfolio\/([^/?#]+)\/(\d+)-([^/?#]+)/;

export function leerTrabajo(html: string, url: string): TrabajoAlboom {
  const raiz = parsearHtml(html);
  const canonica = urlCanonica(raiz) ?? "";
  const ruta = RUTA.exec(url) ?? RUTA.exec(canonica);
  const alboomId = ruta?.[2] ?? atributo(buscar(raiz, "[data-album-id]"), "data-album-id") ?? /[?&]id=(\d+)/.exec(url)?.[1];
  if (!alboomId) throw new Error(`No se encontró el número del trabajo en ${url}`);

  const cabecera = buscar(raiz, "#albumPageHeader") ?? raiz;
  const titulo = textoDe(buscar(cabecera, "h1.ac__title"));
  if (!titulo) throw new Error(`El trabajo ${alboomId} no tiene título`);
  const fechaAttr = atributo(buscar(cabecera, "time.ai--date"), "datetime");
  const contenido = buscar(raiz, "#albumPageContent");
  const { fotos, videos } = contenido ? fotosDelContenido(contenido) : fotosDeLosAlbumesViejos(buscar(raiz, "#albumPage") ?? raiz, alboomId);

  return {
    alboomId,
    categoriaSlug: (ruta?.[1] ?? "").toLowerCase(),
    categoriaNombre: textoDe(buscar(cabecera, ".ai--category")) || null,
    slugAlboom: (ruta?.[3] ?? "").toLowerCase(),
    titulo,
    lugar: textoDe(buscar(cabecera, ".ai--local")) || null,
    fecha: fechaAttr && /^\d{4}-\d{2}-\d{2}$/.test(fechaAttr) ? fechaAttr : null,
    descripcionHtml: quitarParrafoEnvolvente(htmlInterno(buscar(raiz, "#albumPageDescription"), html)),
    fotos,
    videos,
  };
}

/** Los trabajos de hoy: las fotos y los videos dentro de `#albumPageContent`. */
function fotosDelContenido(contenido: Elemento): { fotos: string[]; videos: string[] } {
  return {
    fotos: unicas(
      buscarTodos(contenido, "img")
        .map((img) => mejorUrlDeImagen(img))
        .filter(esUrlDeFoto),
    ),
    videos: unicas(
      buscarTodos(contenido, "iframe")
        .map((f) => atributo(f, "src"))
        .filter(esUrlDeFoto),
    ),
  };
}

/**
 * Los trabajos viejos (2018–2023) no tienen `#albumPageContent`: unos son una grilla de enlaces a
 * la original (`a.acgi__link`) y otros un carrusel (`#fotosVideoCarousel`). Al pie de la página hay
 * tarjetas de otros trabajos: por eso sólo cuentan las fotos de la carpeta de ESTE álbum
 * (`/albuns/<id>/`) — el error de la migración de SFPR fue llevarse fotos ajenas.
 */
function fotosDeLosAlbumesViejos(pagina: Elemento, alboomId: string): { fotos: string[]; videos: string[] } {
  const delAlbum = (u: string) => u.includes(`/albuns/${alboomId}/`);
  const candidatas = [
    ...buscarTodos(pagina, "a.acgi__link").map((a) => atributo(a, "href")),
    ...buscarTodos(pagina, "#fotosVideoCarousel img").map((img) => mejorUrlDeImagen(img)),
  ];
  return {
    fotos: unicas(candidatas.filter(esUrlDeFoto).map(urlOriginal).filter(delAlbum)),
    videos: unicas(
      buscarTodos(pagina, "#fotosVideoCarousel iframe")
        .map((f) => atributo(f, "src"))
        .filter(esUrlDeFoto),
    ),
  };
}
