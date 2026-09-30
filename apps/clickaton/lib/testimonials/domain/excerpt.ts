/**
 * El recorte que sale entre comillas en el sitio público.
 *
 * El admin elige el fragmento; esta función arma el valor sugerido y es la
 * misma que usa la lectura pública cuando no hay fragmento elegido.
 */
import { EXCERPT_MAX_LENGTH } from "./survey-definition";

const ELLIPSIS = "…";

/** Espacios y saltos repetidos a un solo espacio. No pierde nada del texto. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function buildExcerpt(quote: string, max = EXCERPT_MAX_LENGTH): string {
  const normalized = normalizeWhitespace(quote);
  if (normalized.length === 0) return "";
  if (normalized.length <= max) return normalized;

  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Sin espacio no hay dónde cortar limpio: se corta igual antes que devolver
  // un párrafo entero donde se esperaba un fragmento.
  const body = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}${ELLIPSIS}`;
}
