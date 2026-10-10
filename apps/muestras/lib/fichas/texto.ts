import { scanUrl } from "@repo/muestras";

/** Lo que va impreso en la ficha de una obra. */
export type FichaDeObra = { muestra: string; titulo: string; autor: string; detalle: string | null; url: string };

/**
 * Las fuentes estándar del PDF (Helvetica) sólo saben escribir WinAnsi: el castellano entra
 * entero, pero una "Ł" o un emoji hacen fallar a pdf-lib. Se les sacan los diacríticos que no
 * existen ("ź" → "z") y lo que igual no entra sale como "?". Mejor una ficha con un "?" que
 * ninguna ficha.
 */
const EXTRAS_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const entra = (c: string) => {
  const cp = c.codePointAt(0)!;
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || EXTRAS_WINANSI.includes(c);
};

/**
 * Invisibles que llegan pegados desde el celular: selectores de variante de emoji (U+FE00–FE0F),
 * uniones y espacios de ancho cero (U+200B–200D, U+2060, U+FEFF) y el guion opcional (U+00AD).
 * No se ven, así que se sacan antes: si no, cada uno saldría impreso como "?".
 */
const INVISIBLES = /[\u00AD\u200B-\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;

export function paraWinAnsi(s: string): string {
  return Array.from(s.replace(INVISIBLES, "").normalize("NFC"))
    .map((c) => {
      if (/\s/.test(c)) return " ";
      if (entra(c)) return c;
      const base = c.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return base && Array.from(base).every(entra) ? base : "?";
    })
    .join("");
}

/** Corta un texto en líneas que entran en `anchoMax`; si sobran líneas, la última termina en "…". */
export function cortarEnLineas(texto: string, anchoMax: number, medir: (s: string) => number, maxLineas: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.trim().split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (medir(prueba) <= anchoMax) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = palabra;
    // Una palabra sola más ancha que la línea se corta por letras.
    while (medir(actual) > anchoMax && actual.length > 1) {
      let i = actual.length - 1;
      while (i > 1 && medir(actual.slice(0, i)) > anchoMax) i--;
      lineas.push(actual.slice(0, i));
      actual = actual.slice(i);
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return lineas;
  const recortadas = lineas.slice(0, maxLineas);
  let ultima = recortadas[maxLineas - 1]!;
  while (ultima.length > 1 && medir(`${ultima}…`) > anchoMax) ultima = ultima.slice(0, -1).trimEnd();
  recortadas[maxLineas - 1] = `${ultima}…`;
  return recortadas;
}

/**
 * El QR pasa por `/q/s/<código>` cuando la obra tiene código de sala (etapa 6, D29): cuenta el
 * escaneo, da el pase de sala y lleva a la vista de sala. Sin código, por `/q/o/<obra>` (etapa 4),
 * que cuenta y lleva a la página pública. Las fichas impresas antes siguen andando.
 *
 * `extra.detalle`: la línea de datos del expositor ("2024. Giclée. 40 × 60 cm. Edición 2/10"),
 * que reemplaza a la de año y técnica. Nunca lleva el precio.
 */
export function datosDeFicha(
  a: { title: string; slug: string },
  o: { id: string; title: string; authorName: string; year: number | null; technique: string | null },
  baseUrl: string,
  extra: { codigo?: string | null; detalle?: string | null } = {},
): FichaDeObra {
  const basico = [o.year ? String(o.year) : null, o.technique?.trim() || null].filter(Boolean).join(". ");
  const detalle = extra.detalle?.trim() || basico;
  return {
    muestra: a.title,
    titulo: o.title,
    autor: o.authorName.trim() || "Autor sin indicar",
    detalle: detalle || null,
    url: extra.codigo ? scanUrl(baseUrl, "s", extra.codigo) : scanUrl(baseUrl, "o", o.id),
  };
}
