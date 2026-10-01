/**
 * Del texto ya completado al cuerpo del correo (HTML seguro y texto) y al texto de WhatsApp. Puro.
 *
 * - Texto plano: en el HTML todo se escapa. Un párrafo por cada línea en blanco, `<br>` por salto simple.
 * - Sólo se vuelven clicables los enlaces `http(s)://`.
 * - `MARCADOR_FIRMA` (lo que deja `[firma]`) se reemplaza por la firma sin escaparla: viene del
 *   renderer de firmas, que ya la escapó.
 */
import { MARCADOR_FIRMA } from "./constantes";

const ENLACE = /https?:\/\/[^\s<>"']+/gi;
const PUNTUACION_FINAL = new Set([".", ",", ";", ":", "!", "?", "]", "}"]);

/** Local (no el barrel de @repo/communications) para que la vista previa del cliente no cargue el motor de templates. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Saltos de línea en `\n` y sin espacios al final de cada línea. Lineal: nada de regex con `[ \t]+` sin ancla. */
function normalizar(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
}

function contar(s: string, c: string): number {
  let n = 0;
  for (const x of s) if (x === c) n++;
  return n;
}

/**
 * Quita la puntuación final que no es parte del enlace. Un ")" final sólo se quita si sobra
 * (más ")" que "("), así `http://x.com/a_(b)` queda entero y `(ver http://x.com)` no arrastra el ")".
 */
function recortarEnlace(url: string): string {
  let fin = url.length;
  let abiertos = contar(url, "(");
  let cerrados = contar(url, ")");
  while (fin > 0) {
    const c = url[fin - 1]!;
    if (PUNTUACION_FINAL.has(c)) fin--;
    else if (c === ")" && cerrados > abiertos) {
      fin--;
      cerrados--;
    } else break;
  }
  return url.slice(0, fin);
}

function compactar(texto: string): string {
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

/** Escapa un tramo de texto y vuelve clicables sus enlaces http(s). */
function tramoHtml(texto: string): string {
  let html = "";
  let desde = 0;
  for (const m of texto.matchAll(ENLACE)) {
    const url = recortarEnlace(m[0]);
    if (!/^https?:\/\/./i.test(url)) continue;
    html += escapeHtml(texto.slice(desde, m.index));
    const u = escapeHtml(url);
    html += `<a href="${u}" rel="noopener noreferrer">${u}</a>`;
    desde = m.index + url.length;
  }
  html += escapeHtml(texto.slice(desde));
  return html.replace(/\n/g, "<br>");
}

/**
 * HTML del cuerpo del correo. Si el texto no contenía `[firma]`, la agrega al final una sola vez.
 * `conFirma` es la bandera de `completar`; si no se pasa, se detecta por el marcador.
 */
export function cuerpoCorreoHtml(texto: string, firmaHtml: string, conFirma = texto.includes(MARCADOR_FIRMA)): string {
  const t = normalizar(texto);
  const bloques: string[] = [];
  // Las líneas ya vienen sin espacios al final: una línea en blanco es "\n\n".
  for (const parrafo of t.split(/\n\n+/)) {
    parrafo.split(MARCADOR_FIRMA).forEach((parte, i) => {
      if (i > 0 && firmaHtml) bloques.push(firmaHtml);
      const limpia = parte.trim();
      if (limpia) bloques.push(`<p>${tramoHtml(limpia)}</p>`);
    });
  }
  if (!conFirma && !t.includes(MARCADOR_FIRMA) && firmaHtml) bloques.push(firmaHtml);
  return bloques.join("\n");
}

/** Versión texto del correo (la parte `text` del envío). Misma regla de firma que el HTML. */
export function cuerpoCorreoTexto(texto: string, firmaTexto: string, conFirma = texto.includes(MARCADOR_FIRMA)): string {
  const t = normalizar(texto);
  const tenia = t.includes(MARCADOR_FIRMA);
  const firma = firmaTexto.trim();
  const cuerpo = compactar(t.split(MARCADOR_FIRMA).join(firma));
  if (conFirma || tenia || !firma) return cuerpo;
  return cuerpo ? `${cuerpo}\n\n${firma}` : firma;
}

/** Texto para WhatsApp: la firma va sólo si la plantilla pidió `[firma]`; nunca se agrega sola. */
export function textoWhatsapp(texto: string, firmaTexto = ""): string {
  return compactar(normalizar(texto).split(MARCADOR_FIRMA).join(firmaTexto.trim()));
}
