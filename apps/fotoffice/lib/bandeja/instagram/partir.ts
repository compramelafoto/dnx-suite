/**
 * Partir un texto para Instagram, que acepta hasta 1000 bytes por mensaje. Módulo PURO: lo usan el
 * envío y el registro de ecos (cada parte vuelve como un eco propio).
 */

/** Máximo de bytes (UTF-8) de un mensaje de texto de Instagram. */
export const BYTES_MAXIMOS_INSTAGRAM = 1000;

const bytesDe = (s: string) => Buffer.byteLength(s, "utf8");

/** Los caracteres que ve una persona (un emoji compuesto es uno solo), para no cortar nunca dentro de uno. */
function caracteres(texto: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter("es", { granularity: "grapheme" }).segment(texto), (s) => s.segment);
  }
  return Array.from(texto);
}

/**
 * Parte el texto en trozos de a lo sumo `max` bytes que, unidos, dan el texto exacto. Corta después
 * de un párrafo (línea en blanco) si puede; si no, después de un espacio; si no, entre caracteres.
 */
export function partirPorBytes(texto: string, max: number = BYTES_MAXIMOS_INSTAGRAM): string[] {
  if (!texto) return [];
  if (bytesDe(texto) <= max) return [texto];
  const cs = caracteres(texto);
  const tam = cs.map(bytesDe);
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < cs.length) {
    let fin = inicio;
    let bytes = 0;
    let finParrafo = -1;
    let finEspacio = -1;
    while (fin < cs.length && bytes + tam[fin] <= max) {
      bytes += tam[fin];
      fin++;
      if (cs[fin - 1] === "\n" && fin - 2 >= inicio && cs[fin - 2] === "\n") finParrafo = fin;
      if (/^\s+$/.test(cs[fin - 1])) finEspacio = fin;
    }
    if (fin >= cs.length) {
      partes.push(cs.slice(inicio).join(""));
      break;
    }
    // Un único carácter de más de `max` bytes (no pasa con 1000): va solo, entero.
    if (fin === inicio) fin = inicio + 1;
    const corte = finParrafo > inicio ? finParrafo : finEspacio > inicio ? finEspacio : fin;
    partes.push(cs.slice(inicio, corte).join(""));
    inicio = corte;
  }
  return partes;
}
