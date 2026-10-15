/**
 * El enlace al que lleva el testimonio publicado.
 *
 * Es contenido que escribe una persona y que después se publica como `href`:
 * sólo se aceptan `http` y `https`, y el usuario de Instagram sólo con los
 * caracteres que Instagram admite. Cualquier otra cosa devuelve null y el
 * testimonio se publica sin enlace.
 */

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function normalizeAuthorLink(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("@")) {
    const handle = value.slice(1).trim();
    if (!INSTAGRAM_HANDLE.test(handle)) return null;
    return `https://instagram.com/${handle}`;
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)
    ? value
    : `https://${value}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;

  return url.toString();
}
