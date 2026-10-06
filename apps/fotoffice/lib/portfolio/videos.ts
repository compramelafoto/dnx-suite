/**
 * Los videos del portfolio de un socio, agregados pegando una dirección.
 *
 * ── Por qué no es "cualquier red social" ──
 *
 * Embeber un video exige saber cómo lo embebe cada plataforma, y meter una dirección arbitraria en
 * un `<iframe>` dentro del sitio de la institución es abrirle la puerta a cualquier cosa. El repo ya
 * tomó esa decisión para el blog: la lista blanca de iframes es YouTube y Vimeo
 * (`packages/content/src/tiptap/html.ts`), y esto no la contradice.
 *
 * Así que todo se puede agregar, y según de dónde venga se muestra distinto:
 *
 * - **YouTube y Vimeo** — reproductor embebido de verdad, por iframe.
 * - **Instagram y TikTok** — embebido con el script del propio proveedor, igual que los posteos.
 * - **Cualquier otra** — tarjeta con enlace que abre en el sitio de origen. No se embebe, pero el
 *   socio puede mostrarlo igual: un demo reel en su propio sitio es un caso real.
 *
 * Lo único que se rechaza de plano son los esquemas que no son web (`javascript:`, `data:`, `file:`),
 * que son el vector obvio.
 */

/** Doce: los suficientes para mostrar trabajo, sin convertir la página en una pared de players. */
export const MAX_PORTFOLIO_VIDEOS = 12;

export type VideoPlatform = "YOUTUBE" | "VIMEO" | "INSTAGRAM" | "TIKTOK" | "OTRO";

export type PortfolioVideo = {
  platform: VideoPlatform;
  /** Identificador del video. Sólo YouTube y Vimeo lo tienen; el resto se embebe por dirección. */
  videoId: string | null;
  /** La dirección canónica, ya normalizada. */
  url: string;
};

/** Los de YouTube son once caracteres de un alfabeto fijo. Cualquier otra cosa no es un video. */
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

function conEsquema(entrada: string): URL | null {
  const limpio = entrada.trim();
  if (!limpio) return null;

  // Sin esquema asumimos https; con uno que no sea web, no hay nada que hacer.
  const conProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(limpio) ? limpio : `https://${limpio}`;
  try {
    const u = new URL(conProtocolo);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

/** Compara el dominio sin el `www.`, para que las dos formas entren igual. */
function dominio(u: URL): string {
  return u.hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * Reconoce una dirección de video, o `null` si no es ni siquiera una dirección web.
 *
 * Nunca devuelve `null` por no reconocer la plataforma: eso cae en `OTRO`. Sólo falla cuando lo que
 * entró no es algo que un navegador pueda abrir.
 */
export function parsePortfolioVideoUrl(entrada: string): PortfolioVideo | null {
  const u = conEsquema(entrada);
  if (!u) return null;

  const host = dominio(u);
  const partes = u.pathname.split("/").filter(Boolean);

  // ── YouTube ──
  if (host === "youtu.be") {
    const id = partes[0] ?? "";
    if (!ID_YOUTUBE.test(id)) return null;
    return { platform: "YOUTUBE", videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    const porParametro = u.searchParams.get("v");
    const porRuta = partes[0] === "shorts" || partes[0] === "embed" || partes[0] === "live" ? partes[1] : null;
    const id = porParametro ?? porRuta ?? "";
    if (!ID_YOUTUBE.test(id)) return null;
    return { platform: "YOUTUBE", videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }

  // ── Vimeo ──
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // `vimeo.com/123`, `vimeo.com/123/codigo` (privado) y `player.vimeo.com/video/123`.
    const candidato = partes[0] === "video" ? partes[1] : partes[0];
    if (!/^\d+$/.test(candidato ?? "")) return null;
    return { platform: "VIMEO", videoId: candidato, url: `https://vimeo.com/${candidato}` };
  }

  // ── Instagram ──
  if (host === "instagram.com") {
    const tipo = partes[0]?.toLowerCase();
    const codigo = partes[1] ?? "";
    // Un reel o un posteo; un perfil no es un video.
    if (!["p", "reel", "reels", "tv"].includes(tipo ?? "") || !/^[A-Za-z0-9_-]+$/.test(codigo)) {
      return null;
    }
    const tipoCanonico = tipo === "reels" ? "reel" : tipo;
    return {
      platform: "INSTAGRAM",
      videoId: null,
      url: `https://www.instagram.com/${tipoCanonico}/${codigo}/`,
    };
  }

  // ── TikTok ──
  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    return { platform: "TIKTOK", videoId: null, url: `${u.origin}${u.pathname}` };
  }

  // ── Cualquier otra: se enlaza, no se embebe ──
  return { platform: "OTRO", videoId: null, url: `${u.origin}${u.pathname}${u.search}` };
}

export type PortfolioVideosResult =
  | { ok: true; videos: PortfolioVideo[] }
  | { ok: false; error: string };

/**
 * La lista completa, reconocida, sin repetidos y dentro del tope.
 *
 * Los renglones vacíos se descartan en silencio —pegar varias direcciones deja líneas sueltas— pero
 * una que no se entiende **falla y dice cuál**: ahí la persona se equivocó, y tragárselo la dejaría
 * preguntándose por qué falta un video.
 */
export function parsePortfolioVideoUrls(entradas: readonly string[]): PortfolioVideosResult {
  const videos: PortfolioVideo[] = [];
  const vistas = new Set<string>();

  for (const entrada of entradas) {
    if (!entrada.trim()) continue;

    const video = parsePortfolioVideoUrl(entrada);
    if (!video) {
      return {
        ok: false,
        error: `No entendí "${entrada.trim()}". Pegá la dirección completa del video, como la copiás del navegador.`,
      };
    }
    // La dirección canónica como clave: `youtu.be/x` y `youtube.com/watch?v=x` son el mismo video.
    if (vistas.has(video.url)) continue;
    vistas.add(video.url);
    videos.push(video);
  }

  if (videos.length > MAX_PORTFOLIO_VIDEOS) {
    return {
      ok: false,
      error: `Podés mostrar hasta ${MAX_PORTFOLIO_VIDEOS} videos. Sacá ${videos.length - MAX_PORTFOLIO_VIDEOS} de la lista.`,
    };
  }

  return { ok: true, videos };
}

/** Lo que se le muestra a la persona para que sepa qué reconocimos. */
export const ETIQUETA_PLATAFORMA: Record<VideoPlatform, string> = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  OTRO: "Enlace",
};

/** La miniatura, cuando la plataforma la da sin pedir permiso ni clave. */
export function portfolioVideoThumbnail(video: PortfolioVideo): string | null {
  // YouTube la sirve pública por identificador. Vimeo exige una llamada a su API: no vale la pena.
  if (video.platform === "YOUTUBE" && video.videoId) {
    return `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  }
  return null;
}

/** La dirección del reproductor embebido, para las plataformas que lo permiten por iframe. */
export function portfolioVideoEmbedUrl(video: PortfolioVideo): string | null {
  if (video.platform === "YOUTUBE" && video.videoId) {
    // `youtube-nocookie` y sin videos relacionados: es la ficha de alguien, no un portal de videos.
    return `https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&autoplay=1`;
  }
  if (video.platform === "VIMEO" && video.videoId) {
    return `https://player.vimeo.com/video/${video.videoId}?autoplay=1`;
  }
  return null;
}
