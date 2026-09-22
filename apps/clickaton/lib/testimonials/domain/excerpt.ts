/**
 * El recorte que sale entre comillas en el sitio público.
 *
 * El admin elige el fragmento; esta función arma el valor sugerido y es la
 * misma que usa la lectura pública cuando no hay fragmento elegido.
 */
import { EXCERPT_MAX_LENGTH } from "./survey-definition.ts";

const ELLIPSIS = "…";

export function buildExcerpt(quote: string, max = EXCERPT_MAX_LENGTH): string {
  const normalized = quote.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return "";
  if (normalized.length <= max) return normalized;

  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Sin espacio no hay dónde cortar limpio: se corta igual antes que devolver
  // un párrafo entero donde se esperaba un fragmento.
  const body = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}${ELLIPSIS}`;
}
