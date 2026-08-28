/**
 * Normalización de presencia profesional (redes y sitio web).
 *
 * Nadie escribe estos datos de la misma forma. Para el mismo perfil de Instagram llegan
 * "@juanperez", "juanperez", "instagram.com/juanperez" y
 * "https://www.instagram.com/juanperez/?hl=es". Si se guarda tal cual, el mismo socio queda
 * escrito de cuatro maneras y no hay forma de mostrarlo parejo ni de detectar duplicados.
 *
 * Hay una decisión deliberada acá: **Instagram y TikTok se guardan como usuario** (el "@" es
 * su forma canónica y única), mientras que **Facebook, YouTube y LinkedIn se guardan como URL
 * completa**. En esas tres la dirección tiene formas distintas y legítimas —perfiles viejos con
 * `profile.php?id=`, canales `@handle` o `channel/UC…`, `in/` o `company/`— y forzarlas a un
 * usuario perdería direcciones válidas. Es mejor guardar algo largo que guardar algo roto.
 */

/** Redes que se guardan como usuario, sin arroba ni dirección. */
export const REDES_POR_USUARIO = ["instagram", "tiktok"] as const;
/** Redes que se guardan como dirección completa. */
export const REDES_POR_URL = ["facebook", "youtube", "linkedin"] as const;

export type RedPorUsuario = (typeof REDES_POR_USUARIO)[number];
export type RedPorUrl = (typeof REDES_POR_URL)[number];

const DOMINIOS: Record<RedPorUsuario | RedPorUrl, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.com", "fb.me", "m.facebook.com"],
  youtube: ["youtube.com", "youtu.be", "m.youtube.com"],
  linkedin: ["linkedin.com"],
};

/** Reglas reales de cada plataforma. */
const USUARIO_VALIDO: Record<RedPorUsuario, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/,
  tiktok: /^[a-z0-9._]{1,24}$/,
};

export type ResultadoSocial<T> =
  | { ok: true; valor: T | null }
  | { ok: false; error: string };

const ESQUEMAS_PELIGROSOS = /^\s*(javascript|data|vbscript|file):/i;

function limpiar(valor: string | null | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}

/**
 * Extrae el usuario de lo que sea que hayan pegado.
 *
 * Si viene una dirección, exige que sea de la red correcta: pegar un perfil de Facebook en el
 * campo de Instagram es un error de la persona, y guardarlo en silencio haría que el enlace
 * llevara a un perfil que no existe.
 */
export function normalizarUsuarioRed(
  red: RedPorUsuario,
  entrada: string | null | undefined
): ResultadoSocial<string> {
  const bruto = limpiar(entrada);
  if (!bruto) return { ok: true, valor: null };
  if (ESQUEMAS_PELIGROSOS.test(bruto)) {
    return { ok: false, error: "Esa dirección no es válida." };
  }

  let texto = bruto;

  // Si parece una dirección, quedarse con el primer tramo del camino.
  const pareceUrl = /^https?:\/\//i.test(texto) || /^[\w.-]+\.[a-z]{2,}\//i.test(texto);
  if (pareceUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    } catch {
      return { ok: false, error: "Esa dirección no es válida." };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!DOMINIOS[red].includes(host)) {
      return {
        ok: false,
        error: `Esa dirección no es de ${etiquetaRed(red)}. Poné tu usuario o el enlace correcto.`,
      };
    }
    texto = url.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  texto = texto.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  if (!texto) return { ok: true, valor: null };

  if (!USUARIO_VALIDO[red].test(texto)) {
    return {
      ok: false,
      error: `El usuario de ${etiquetaRed(red)} no parece válido.`,
    };
  }
  return { ok: true, valor: texto };
}

/**
 * Normaliza una dirección de red social. Guarda la dirección entera porque en estas
 * plataformas no hay una única forma de perfil.
 */
export function normalizarUrlRed(
  red: RedPorUrl,
  entrada: string | null | undefined
): ResultadoSocial<string> {
  const bruto = limpiar(entrada);
  if (!bruto) return { ok: true, valor: null };
  const url = aUrlSegura(bruto);
  if (!url) return { ok: false, error: "Esa dirección no es válida." };

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!DOMINIOS[red].includes(host)) {
    return { ok: false, error: `Esa dirección no es de ${etiquetaRed(red)}.` };
  }
  return { ok: true, valor: url.toString() };
}

/**
 * Sitio web propio. Acepta que lo escriban sin "https://", que es lo más común.
 */
export function normalizarSitioWeb(
  entrada: string | null | undefined
): ResultadoSocial<string> {
  const bruto = limpiar(entrada);
  if (!bruto) return { ok: true, valor: null };
  const url = aUrlSegura(bruto);
  if (!url) return { ok: false, error: "El sitio web no parece una dirección válida." };
  // Un sitio sin punto en el dominio ("localhost", "miweb") no lleva a ningún lado.
  if (!url.hostname.includes(".")) {
    return { ok: false, error: "El sitio web no parece una dirección válida." };
  }
  return { ok: true, valor: url.toString() };
}

function aUrlSegura(bruto: string): URL | null {
  if (ESQUEMAS_PELIGROSOS.test(bruto)) return null;
  if (bruto.length > 500) return null;
  const conEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  let url: URL;
  try {
    url = new URL(conEsquema);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url;
}

export function etiquetaRed(red: RedPorUsuario | RedPorUrl): string {
  const etiquetas: Record<RedPorUsuario | RedPorUrl, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    facebook: "Facebook",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };
  return etiquetas[red];
}

/** Dirección para mostrar, a partir del usuario guardado. */
export function urlDeUsuario(red: RedPorUsuario, usuario: string): string {
  const base = red === "instagram" ? "https://instagram.com" : "https://tiktok.com/@";
  return red === "instagram" ? `${base}/${usuario}` : `${base}${usuario}`;
}
