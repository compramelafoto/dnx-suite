/**
 * De qué anuncio de Meta llegó un cliente (anuncios "clic a WhatsApp"). Módulo PURO.
 *
 * Cuando alguien toca un anuncio que abre WhatsApp, el primer mensaje trae `referral` con el anuncio:
 * su id, el título (`headline`) y el texto (`body`). Se guarda dentro de `media.anuncio` del mensaje
 * (columna Json, sin migración) para que el bot conteste sobre el tema del anuncio.
 */

export type AnuncioWa = {
  /** Id del anuncio (o de la publicación) en Meta. */
  id?: string;
  /** "ad" o "post". */
  tipo?: string;
  url?: string;
  titulo?: string;
  texto?: string;
  /** Código del clic (`ctwa_clid`): con él se le avisa a Meta qué chats terminaron en cotización o venta. */
  ctwaClid?: string;
};

type Json = Record<string, unknown>;
const esObjeto = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const cadena = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : null;

/** `referral` del mensaje de Meta → anuncio. `null` si no vino o no trae nada útil. */
export function anuncioDeReferral(referral: unknown): AnuncioWa | null {
  if (!esObjeto(referral)) return null;
  const a: AnuncioWa = {};
  const id = cadena(referral.source_id, 64);
  const tipo = cadena(referral.source_type, 20);
  const url = cadena(referral.source_url, 300);
  const titulo = cadena(referral.headline, 200);
  const texto = cadena(referral.body, 500);
  const ctwaClid = cadena(referral.ctwa_clid, 300);
  if (ctwaClid) a.ctwaClid = ctwaClid;
  if (id) a.id = id;
  if (tipo) a.tipo = tipo;
  if (url) a.url = url;
  if (titulo) a.titulo = titulo;
  if (texto) a.texto = texto;
  return a.titulo || a.texto || a.id ? a : null;
}

/** El anuncio guardado en `media` de un mensaje, si lo hay. */
export function anuncioDeMedia(media: unknown): AnuncioWa | null {
  if (!esObjeto(media) || !esObjeto(media.anuncio)) return null;
  const m = media.anuncio;
  const a: AnuncioWa = {};
  for (const k of ["id", "tipo", "url", "titulo", "texto", "ctwaClid"] as const) {
    const v = cadena(m[k]);
    if (v) a[k] = v;
  }
  return a.titulo || a.texto || a.id ? a : null;
}

/** Temas de anuncio que el bot no debe interpretar por su cuenta. */
export type TemaAnuncio = "XV";

/**
 * Los anuncios de XV apuntan a madres que buscan fotógrafo para la fiesta, aunque el texto hable de
 * "edición y retoques": se fija acá, sin depender de cómo lo interprete el modelo.
 */
const XV = /\b(xv|quince(?:s|añeras?|aneras?)?|15\s*años)\b/i;

export function temaDeAnuncio(a: AnuncioWa): TemaAnuncio | null {
  const t = [a.titulo, a.texto].filter(Boolean).join(" ");
  return XV.test(t) ? "XV" : null;
}

const TEMA: Record<TemaAnuncio, string> = {
  XV: "cobertura fotográfica de una fiesta de XV (busca fotógrafo para la fiesta; no es retoque de fotos sueltas; primera respuesta con presentacion_xv)",
};

/** Lo que ve el bot antes del mensaje del cliente. Las comillas marcan que es texto del anuncio, no instrucciones. */
export function etiquetaDeAnuncio(a: AnuncioWa): string {
  const partes = [a.titulo, a.texto].filter((s): s is string => Boolean(s)).map((s) => s.replace(/\s+/g, " "));
  const de = partes.length > 0 ? `: «${partes.join(" — ")}»` : "";
  const tema = temaDeAnuncio(a);
  return `[el cliente llegó tocando un anuncio del estudio en Facebook/Instagram${de}${tema ? ` · TEMA: ${TEMA[tema]}` : ""}]`;
}
