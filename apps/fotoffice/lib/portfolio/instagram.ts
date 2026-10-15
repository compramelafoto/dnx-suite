/**
 * Los posteos de Instagram que el socio elige mostrar en su ficha.
 *
 * ── Por qué son elegidos y no el feed ──
 *
 * Mostrar "las últimas fotos" de una cuenta a partir de su usuario **no se puede** desde que Meta
 * cerró la Basic Display API, en diciembre de 2024. Hoy leer la obra de alguien exige una app
 * aprobada por Meta, que su cuenta sea Business o Creator, y que autorice con OAuth. Para un padrón
 * de fotógrafos con cuentas personales, eso no se sostiene.
 *
 * Lo que sí funciona sin nada de eso es embeber posteos puntuales por su dirección. Así que el
 * socio elige cuáles mostrar. Pierde actualización automática y gana control: muestra su mejor
 * trabajo, no lo último que subió.
 *
 * ── Por qué se valida tan de cerca ──
 *
 * Estas direcciones terminan dentro de un `blockquote` que el script de Instagram convierte en un
 * embebido, en el sitio público de la institución. Una dirección que no sea de Instagram ahí es una
 * puerta abierta, y `javascript:` o `data:` son el vector obvio. Sólo pasa lo que coincide exacto.
 */

/** Seis entran en una franja sin que haya que desplazarse eternamente. */
export const MAX_INSTAGRAM_POSTS = 6;

/**
 * Un posteo o un reel, y nada más.
 *
 * El código de Instagram es alfanumérico con guiones y guiones bajos; cualquier otra cosa —una
 * barra, un espacio— significa que no es lo que parece.
 */
const POSTEO = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/i;

/**
 * Deja la dirección en su forma canónica, o `null` si no es un posteo.
 *
 * Normaliza en vez de rechazar lo que es recuperable: quien copia desde la aplicación pega algo con
 * `?igsh=...` colgando, y quien copia a mano se olvida del `https://`. Las dos son la misma
 * dirección y las dos tienen que entrar.
 */
export function normalizeInstagramPostUrl(entrada: string): string | null {
  const limpio = entrada.trim();
  if (!limpio) return null;

  // Los parámetros de seguimiento no aportan nada y ensucian el embebido.
  const sinParametros = limpio.split("?")[0].split("#")[0];

  const m = POSTEO.exec(sinParametros);
  if (!m) return null;

  const [, tipo, codigo] = m;
  return `https://www.instagram.com/${tipo.toLowerCase()}/${codigo}/`;
}

export type InstagramUrlsResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

/**
 * La lista completa, normalizada, sin repetidos y dentro del tope.
 *
 * Los renglones vacíos se descartan en silencio —pegar varias direcciones deja líneas sueltas— pero
 * una dirección que no es un posteo **falla y dice cuál**: ahí la persona se equivocó de verdad, y
 * tragárselo en silencio la dejaría preguntándose por qué falta una.
 */
export function parseInstagramPostUrls(entradas: readonly string[]): InstagramUrlsResult {
  const urls: string[] = [];

  for (const entrada of entradas) {
    if (!entrada.trim()) continue;

    const normalizada = normalizeInstagramPostUrl(entrada);
    if (!normalizada) {
      return {
        ok: false,
        error: `"${entrada.trim()}" no es el enlace de un posteo de Instagram. Abrí el posteo, tocá los tres puntos y elegí "Copiar enlace".`,
      };
    }
    if (!urls.includes(normalizada)) urls.push(normalizada);
  }

  if (urls.length > MAX_INSTAGRAM_POSTS) {
    return {
      ok: false,
      error: `Podés mostrar hasta ${MAX_INSTAGRAM_POSTS} posteos. Sacá ${urls.length - MAX_INSTAGRAM_POSTS} de la lista.`,
    };
  }

  return { ok: true, urls };
}
