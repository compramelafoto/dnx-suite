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
  | { tipo: "soporte" }
  /** Link del mail de respuesta de soporte: el reclamo se sigue en el bot. */
  | { tipo: "caso"; token: string };

const MAX_LARGO = 300;
const SLUG = /^[a-z0-9-]{1,120}$/i;
const TOKEN_DESCARGA = /^[0-9a-f]{32,128}$/;
const TOKEN_PACK = /^[A-Za-z0-9_-]{20,200}$/;
const TOKEN_CASO = /^[A-Za-z0-9_-]{40,200}$/;
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
    case "caso":
      return s.length === 2 && TOKEN_CASO.test(s[1]) ? { tipo: "caso", token: s[1] } : null;
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
    case "caso": return "/caso/[token]";
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
/** Aire entre la burbuja y el botón o la barra de pago que tiene abajo. */
export const AIRE_SOBRE_BOTON = 12;
/** Atributo que marcan los botones y barras de pago fijos que la burbuja no tiene que tapar. */
export const ATRIBUTO_EVITAR = "data-dnxbot-evitar";

/**
 * Cuánto se separa la burbuja del borde de abajo, medido en el navegador: justo por encima del más alto
 * de los botones o barras de pago fijos que están visibles (`tops` = su borde de arriba). Sin ninguno,
 * queda en su lugar de siempre. Puro.
 */
export function margenSobreBotones(tops: number[], altoVentana: number): number {
  let margen = MARGEN_BURBUJA_NORMAL;
  for (const top of tops) {
    if (!Number.isFinite(top) || top >= altoVentana || top < 0) continue;
    margen = Math.max(margen, Math.ceil(altoVentana - top) + AIRE_SOBRE_BOTON);
  }
  return margen;
}
