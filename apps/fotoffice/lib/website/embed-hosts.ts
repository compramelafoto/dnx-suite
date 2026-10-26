/**
 * Qué se puede incrustar en una página del sitio. Un iframe mete una página ajena dentro de la
 * del dueño, así que sólo se admiten hosts conocidos y siempre por https; cualquier otra cosa no
 * se dibuja (las vistas devuelven `null`). La lista es la misma que usa el sanitizador de
 * `@repo/content` para los iframes del texto con formato, más CompraMeLaFoto y Google Maps.
 */
const EMBED_HOSTS = new Set([
  "compramelafoto.com",
  "www.compramelafoto.com",
  "www.youtube.com",
  "youtube.com",
  "player.vimeo.com",
]);

/** Id de video de YouTube / Vimeo: sólo letras, números, guion y guion bajo. */
const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const VIMEO_ID = /^\d{1,20}$/;

function parseHttps(url: string): URL | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** URL pública de un video de YouTube o Vimeo → URL del reproductor embebido. Otra cosa → null. */
export function toVideoEmbedUrl(url: string): string | null {
  const parsed = parseHttps(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  let youtubeId: string | null = null;
  if (host === "youtu.be") {
    youtubeId = segments[0] ?? null;
  } else if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    if (segments[0] === "watch") youtubeId = parsed.searchParams.get("v");
    else if (segments[0] === "shorts" || segments[0] === "embed") youtubeId = segments[1] ?? null;
  }
  if (youtubeId !== null) return VIDEO_ID.test(youtubeId) ? `https://www.youtube.com/embed/${youtubeId}` : null;

  let vimeoId: string | null = null;
  if (host === "vimeo.com" || host === "www.vimeo.com") vimeoId = segments[0] ?? null;
  else if (host === "player.vimeo.com" && segments[0] === "video") vimeoId = segments[1] ?? null;
  if (vimeoId !== null && VIMEO_ID.test(vimeoId)) return `https://player.vimeo.com/video/${vimeoId}`;

  return null;
}

/** ¿Se puede poner esta URL en un iframe? https + host de la lista; de Google, sólo `/maps/embed`. */
export function isAllowedEmbedUrl(url: string): boolean {
  const parsed = parseHttps(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (EMBED_HOSTS.has(host)) return true;
  if (host === "www.google.com") return parsed.pathname === "/maps/embed" || parsed.pathname.startsWith("/maps/embed/");
  return false;
}
