/**
 * Qué página de CompraMeLaFoto está mirando el comprador. Puro y sin imports de servidor:
 * lo usa también la burbuja en el navegador.
 */
export type PaginaComprador =
  | { tipo: "album"; slug: string }
  | { tipo: "album_id"; albumId: number; photoId: number | null }
  | { tipo: "descarga"; token: string }
  | { tipo: "pack"; token: string }
  | { tipo: "recuperar_pack" }
  | { tipo: "pago"; resultado: "failure" | "pending" | "success"; orderId: number | null }
  | { tipo: "mis_pedidos" }
  | { tipo: "soporte" };

const MAX_LARGO = 300;
const SLUG = /^[a-z0-9-]{1,120}$/i;
const TOKEN_DESCARGA = /^[0-9a-f]{32,128}$/;
const TOKEN_PACK = /^[A-Za-z0-9_-]{20,200}$/;
const NUMERO = /^\d+$/;

function enteroPositivo(s: string | null | undefined): number | null {
  if (!s || !NUMERO.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Recibe `pathname` con `?search` opcional. Devuelve null si en esa página no va el bot. */
export function contextoDePagina(pagePath: string): PaginaComprador | null {
  if (typeof pagePath !== "string" || pagePath.length > MAX_LARGO) return null;
  const sinHash = pagePath.split("#")[0];
  const q = sinHash.indexOf("?");
  const pathname = q === -1 ? sinHash : sinHash.slice(0, q);
  const search = q === -1 ? "" : sinHash.slice(q + 1);
  if (!pathname.startsWith("/")) return null;
  const s = pathname.split("/").slice(1);
  if (s.length > 1 && s[s.length - 1] === "") s.pop();

  switch (s[0]) {
    case "album": {
      // El bot no tapa los botones de pago: fuera de /album/{slug}/comprar…
      if (s.length < 2 || !SLUG.test(s[1]) || s[2] === "comprar") return null;
      return { tipo: "album", slug: s[1].toLowerCase() };
    }
    case "a": {
      const albumId = enteroPositivo(s[1]);
      if (albumId === null) return null;
      if (s.length === 2) return { tipo: "album_id", albumId, photoId: null };
      if (s.length === 4 && s[2] === "remover") {
        const photoId = enteroPositivo(s[3]);
        return photoId === null ? null : { tipo: "album_id", albumId, photoId };
      }
      return null; // comprar, canje, instructivo y cualquier otra subruta
    }
    case "descargas":
      return s.length === 2 && TOKEN_DESCARGA.test(s[1]) ? { tipo: "descarga", token: s[1] } : null;
    case "cliente": {
      if (s.length === 2 && s[1] === "pedidos") return { tipo: "mis_pedidos" };
      if (s.length === 2 && s[1] === "soporte") return { tipo: "soporte" };
      if (s.length === 2 && s[1] === "recuperar-pack") return { tipo: "recuperar_pack" };
      if (s.length === 3 && s[1] === "pack") {
        if (NUMERO.test(s[2])) return { tipo: "mis_pedidos" }; // /cliente/pack/{orderId}: vista con sesión
        return TOKEN_PACK.test(s[2]) ? { tipo: "pack", token: s[2] } : null;
      }
      return null;
    }
    case "pago": {
      const r = s[1];
      if (s.length !== 2 || (r !== "failure" && r !== "pending" && r !== "success")) return null;
      return { tipo: "pago", resultado: r, orderId: enteroPositivo(new URLSearchParams(search).get("orderId")) };
    }
    default:
      return null;
  }
}

/** Ruta que se puede guardar o mostrar: nunca incluye un token. */
export function pagePathSeguro(p: PaginaComprador): string {
  switch (p.tipo) {
    case "album": return `/album/${p.slug}`;
    case "album_id": return `/a/${p.albumId}`;
    case "descarga": return "/descargas/[token]";
    case "pack": return "/cliente/pack/[token]";
    case "pago": return `/pago/${p.resultado}`;
    case "recuperar_pack": return "/cliente/recuperar-pack";
    case "mis_pedidos": return "/cliente/pedidos";
    case "soporte": return "/cliente/soporte";
  }
}

/** Páginas de `/cliente/*` que muestran la burbuja de compradores. */
export function esRutaClienteConBot(pathname: string): boolean {
  return (
    pathname === "/cliente/pedidos" ||
    pathname === "/cliente/soporte" ||
    pathname === "/cliente/recuperar-pack" ||
    pathname.startsWith("/cliente/pack/")
  );
}

/** Distancia normal de la burbuja al borde de abajo (la de `DnxBotBubble`). */
export const MARGEN_BURBUJA_NORMAL = 24;
/**
 * Preventa (`/album/{slug}/preventa`): barra fija de pago en celular (PreventaPage.tsx, `sm:hidden`).
 * Alto máximo: borde 1 + `py-3` 12 + aviso «Estamos preparando…» 16 + `gap-2` 8 + botón «Pagar» 48
 * + `pb-[max(0.75rem, safe-area)]` hasta 34 en iPhone = 119 px, más 16 de aire.
 */
export const MARGEN_BURBUJA_PREVENTA = 136;
/**
 * Página del álbum (`/album/{slug}`, `/a/{id}`): `PurchaseStickyBar` (compra V2) o el botón flotante
 * «Comprar» de ClientAlbumView (abajo a la derecha). Sólo aparecen con fotos elegidas: se usa el máximo.
 * Barra V2: borde 1 + `py-3` 24 + hasta 4 líneas de resumen con `space-y-1` 92 + `mb-3` 12 + botón 48
 * + acción secundaria 28 + safe-area 34 = 239 px, más aire.
 */
export const MARGEN_BURBUJA_ALBUM = 248;

/**
 * Cuánto se separa la burbuja del borde de abajo para no tapar las barras de pago fijas de cada página.
 * Puro: lo usa la burbuja en el navegador con el `pathname`.
 */
export function margenBurbujaComprador(pathname: string): number {
  const s = pathname.split("/").slice(1);
  if (s.length > 1 && s[s.length - 1] === "") s.pop();
  if (s[0] === "album" && s.length === 3 && (s[2] === "preventa" || s[2] === "precompra")) return MARGEN_BURBUJA_PREVENTA;
  const p = contextoDePagina(pathname);
  if ((p?.tipo === "album" && s.length === 2) || (p?.tipo === "album_id" && p.photoId === null)) return MARGEN_BURBUJA_ALBUM;
  return MARGEN_BURBUJA_NORMAL;
}
