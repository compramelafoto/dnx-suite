/**
 * Enlaces de CompraMeLaFoto (etapa 1 de la conexión FOTOFFICE ↔ CLF). Módulo puro.
 *
 * Se aceptan sólo `https://compramelafoto.com` y `https://www.compramelafoto.com`, con las rutas
 * `/album/<slug>` (y cualquier subruta, por ejemplo `/album/<slug>/preventa`) y `/a/<id>`.
 */

export const CLF_BASE_URL = "https://www.compramelafoto.com";

const DOMINIOS = new Set(["compramelafoto.com", "www.compramelafoto.com"]);
const SLUG = /^[a-z0-9-]{1,200}$/i;

export type ReferenciaAlbumClf = { tipo: "slug"; slug: string } | { tipo: "id"; id: number };

/** El texto pegado (con o sin `https://`, con espacios, `?…` o `#…`) → la referencia al álbum, o null. */
export function interpretarEnlaceClf(texto: string): ReferenciaAlbumClf | null {
  const limpio = texto.trim();
  if (!limpio || /\s/.test(limpio)) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
  let url: URL;
  try {
    url = new URL(conEsquema);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!DOMINIOS.has(url.hostname.toLowerCase())) return null;

  const partes = url.pathname.split("/").filter(Boolean);
  if (partes[0] === "album" && partes[1] && SLUG.test(partes[1])) return { tipo: "slug", slug: partes[1] };
  if (partes[0] === "a" && partes[1] && /^\d{1,10}$/.test(partes[1]) && partes.length === 2) {
    const id = Number(partes[1]);
    if (id > 0 && id <= 2_147_483_647) return { tipo: "id", id };
  }
  return null;
}

/** El enlace que se comparte: el de la preventa si el álbum tiene o tuvo packs; si no, el del álbum. */
export function enlaceDelAlbumClf(a: { slug: string; tienePreventa: boolean }, base: string = CLF_BASE_URL): string {
  const raiz = `${base.replace(/\/+$/, "")}/album/${encodeURIComponent(a.slug)}`;
  return a.tienePreventa ? `${raiz}/preventa` : raiz;
}
