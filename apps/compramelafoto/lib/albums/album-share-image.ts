/**
 * Imagen de previsualización al compartir un álbum (Open Graph / WhatsApp / redes).
 *
 * Para álbumes escolares el logo del colegio identifica la venta mucho mejor que
 * la marca genérica de la plataforma, así que manda el logo de la escuela asociada.
 */
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-public-url";

function isAbsolute(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * URL absoluta del logo de la escuela, lista para usar como imagen al compartir.
 * Devuelve `null` cuando no hay logo o cuando R2 no está configurado, para que el
 * llamador caiga en su propio fallback en vez de romper la página.
 */
export function resolveSchoolShareImageUrl(
  schoolLogoUrl: string | null | undefined,
  siteOrigin: string
): string | null {
  const raw = schoolLogoUrl?.trim();
  if (!raw) return null;

  let resolved: string;
  try {
    if (isAbsolute(raw)) {
      // Un logo guardado apuntando al entorno local no sirve para compartir:
      // lo reescribimos contra el bucket público.
      resolved =
        raw.includes("localhost") || raw.includes("127.0.0.1")
          ? getR2PublicUrl(urlToR2Key(raw))
          : raw;
    } else {
      resolved = getR2PublicUrl(raw.replace(/^\//, ""));
    }
  } catch {
    return null;
  }

  if (!resolved) return null;
  if (isAbsolute(resolved)) return resolved;

  const base = siteOrigin.replace(/\/+$/, "");
  return `${base}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}
