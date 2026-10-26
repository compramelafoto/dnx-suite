import { urlCanonica } from "./articulo";
import { atributo, buscar, buscarTodos, htmlInterno, parsearHtml, quitarParrafoEnvolvente, textoDe } from "./dom";
import { esUrlDeFoto, mejorUrlDeImagen, unicas } from "./fotos";

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

  return {
    alboomId,
    categoriaSlug: (ruta?.[1] ?? "").toLowerCase(),
    categoriaNombre: textoDe(buscar(cabecera, ".ai--category")) || null,
    slugAlboom: (ruta?.[3] ?? "").toLowerCase(),
    titulo,
    lugar: textoDe(buscar(cabecera, ".ai--local")) || null,
    fecha: fechaAttr && /^\d{4}-\d{2}-\d{2}$/.test(fechaAttr) ? fechaAttr : null,
    descripcionHtml: quitarParrafoEnvolvente(htmlInterno(buscar(raiz, "#albumPageDescription"), html)),
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
