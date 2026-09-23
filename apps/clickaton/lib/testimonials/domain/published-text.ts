/**
 * El texto que sale publicado.
 *
 * Por defecto va el testimonio **completo**, tal como lo escribió el autor.
 * Recortarlo por nuestra cuenta le cambia el sentido a lo que alguien se tomó
 * el trabajo de escribir, y en la home se leía como una frase cortada.
 *
 * El recorte del admin sigue existiendo, pero es opcional: sirve para cuando
 * un testimonio largo tiene una frase que se sostiene sola.
 */
import { normalizeWhitespace } from "./excerpt";

export function publishedText(testimonial: {
  quote: string;
  highlightedExcerpt: string | null;
}): string {
  const chosen = normalizeWhitespace(testimonial.highlightedExcerpt ?? "");
  if (chosen) return chosen;
  return normalizeWhitespace(testimonial.quote);
}
