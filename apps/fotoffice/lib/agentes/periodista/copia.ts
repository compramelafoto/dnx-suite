/**
 * Detector simple de copia (spec: "se rechaza si el cuerpo trae frases largas idénticas a la
 * fuente"). Compara secuencias de N palabras seguidas (por defecto 12) entre la nota y los
 * extractos de la fuente que tengamos: las citas que devolvió la búsqueda y el texto de la página
 * de la noticia. Ignora mayúsculas, tildes y puntuación, así que un copiar-pegar con otra
 * puntuación también cae. No detecta traducciones: eso lo cuida la instrucción al modelo.
 * Módulo PURO.
 */

export const PALABRAS_SEGUIDAS = 12;

/** Palabras en minúscula y sin tildes ni puntuación. */
export function palabras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", mdash: "—", ndash: "–",
};

/** El texto visible de una página HTML (sin scripts, estilos ni etiquetas). */
export function textoDeHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entera, cuerpo: string) => {
      if (cuerpo[0] === "#") {
        const n = cuerpo[1] === "x" || cuerpo[1] === "X" ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
      }
      return ENTIDADES[cuerpo] ?? ENTIDADES[cuerpo.toLowerCase()] ?? entera;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Las frases de la nota (de `n` palabras o más, ya normalizadas) que aparecen idénticas en algún
 * extracto. Vacío = no hay copia. Las secuencias superpuestas se juntan en una sola frase.
 */
export function frasesCopiadas(cuerpo: string, extractos: string[], n: number = PALABRAS_SEGUIDAS): string[] {
  const vistas = new Set<string>();
  for (const extracto of extractos) {
    const p = palabras(extracto);
    for (let i = 0; i + n <= p.length; i++) vistas.add(p.slice(i, i + n).join(" "));
  }
  if (vistas.size === 0) return [];
  const nota = palabras(cuerpo);
  const frases: string[] = [];
  let i = 0;
  while (i + n <= nota.length) {
    if (!vistas.has(nota.slice(i, i + n).join(" "))) {
      i++;
      continue;
    }
    // Extiende la coincidencia mientras la ventana siguiente también esté en la fuente.
    let fin = i + n;
    while (fin < nota.length && vistas.has(nota.slice(fin - n + 1, fin + 1).join(" "))) fin++;
    frases.push(nota.slice(i, fin).join(" "));
    i = fin;
  }
  return frases;
}
