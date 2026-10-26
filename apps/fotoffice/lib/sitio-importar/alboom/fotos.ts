import { atributo, type Elemento } from "./dom";

/**
 * Direcciones de las fotos de Alboom.
 *
 * Alboom guarda cada foto una sola vez en `storage.alboom.ninja` y las muestra a través de su
 * redimensionador (`alfred.alboompro.com/crop|resize/.../url/<ruta en storage>`), que recorta o
 * achica según la página. El importador siempre quiere la original: se saca el prefijo de alfred
 * y el `?t=` del final (sólo rompe la caché del navegador; con él la misma foto tendría dos
 * direcciones y se copiaría dos veces).
 */

const ALFRED = /^https?:\/\/alfred\.alboompro\.com\/(?:crop|resize)\/.*?\/url\/(.+)$/i;
const HOSTS_CON_CACHE_EN_QUERY = new Set(["storage.alboom.ninja", "cdn.alboompro.com"]);

export function urlOriginal(urlAlfred: string): string {
  let url = urlAlfred.trim();
  const m = ALFRED.exec(url);
  if (m) url = /^https?:\/\//i.test(m[1]) ? m[1] : `https://${m[1]}`;
  try {
    const u = new URL(url);
    if (HOSTS_CON_CACHE_EN_QUERY.has(u.hostname)) {
      u.protocol = "https:";
      u.search = "";
      u.hash = "";
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** ¿Es una foto que vale la pena copiar? (nada de `data:` de los marcadores de carga diferida). */
export function esUrlDeFoto(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

/**
 * La mejor dirección de una `<img>` de Alboom, ya convertida a la original. El editor de páginas
 * pone las versiones en `data-image-size-<ancho>` (se toma la más ancha); el resto de las páginas,
 * en `data-original`; si no hay ninguna, `src` (que suele ser un `data:` de relleno).
 */
export function mejorUrlDeImagen(img: Elemento): string | null {
  let mejor: { ancho: number; url: string } | null = null;
  for (const [nombre, valor] of Object.entries(img.attrs)) {
    const m = /^data-image-size-(\d+)$/.exec(nombre);
    if (!m || !esUrlDeFoto(valor)) continue;
    const ancho = Number(m[1]);
    if (!mejor || ancho > mejor.ancho) mejor = { ancho, url: valor };
  }
  const candidata = mejor?.url ?? atributo(img, "data-original") ?? atributo(img, "src");
  return esUrlDeFoto(candidata) ? urlOriginal(candidata) : null;
}

/** Las `url('...')` de un atributo `style` (fondos de portada). */
export function urlsDeFondo(style: string | null | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(style))) if (esUrlDeFoto(m[1])) out.push(urlOriginal(m[1]));
  return out;
}

/** Sin repetidas, conservando el orden. */
export function unicas(urls: string[]): string[] {
  return [...new Set(urls)];
}
