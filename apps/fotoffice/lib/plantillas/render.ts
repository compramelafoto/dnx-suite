/**
 * Del texto ya completado al cuerpo del correo (HTML seguro y texto) y al texto de WhatsApp. Puro.
 *
 * - Texto plano: en el HTML todo se escapa. Un párrafo por cada línea en blanco, `<br>` por salto simple.
 * - Sólo se vuelven clicables los enlaces `http(s)://`.
 * - `MARCADOR_FIRMA` (lo que deja `[firma]`) se reemplaza por la firma sin escaparla: viene del
 *   renderer de firmas, que ya la escapó.
 */
import { escapeHtml } from "@repo/communications/templates";
import { MARCADOR_FIRMA } from "./constantes";

const ENLACE = /https?:\/\/[^\s<>"']+/gi;
const PUNTUACION_FINAL = /[.,;:!?)\]}]+$/;

function normalizar(texto: string): string {
  return texto.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n");
}

function compactar(texto: string): string {
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

/** Escapa un tramo de texto y vuelve clicables sus enlaces http(s). */
function tramoHtml(texto: string): string {
  let html = "";
  let desde = 0;
  for (const m of texto.matchAll(ENLACE)) {
    let url = m[0];
    const sobra = url.match(PUNTUACION_FINAL)?.[0] ?? "";
    url = url.slice(0, url.length - sobra.length);
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
  for (const parrafo of t.split(/\n[ \t]*\n/)) {
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
