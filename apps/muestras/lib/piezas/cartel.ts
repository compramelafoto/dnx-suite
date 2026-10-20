import { PDFDocument } from "pdf-lib";
import { POSTER_SIZES, largestThatFits, type PosterSize } from "@repo/muestras";
import { GRIS, LINEA, MM, TINTA, bloque, cargarFuentes, dibujarLineas, dibujarQr, lineasConParrafos, prepararDocumento } from "./dibujo";
import type { DatosCartel } from "./textos";

const INTERLINEA = 1.35;

/** Recorta la última línea para que entre con "…" al final. */
function conPuntos(linea: string, ancho: number, medir: (s: string) => number): string {
  let l = linea;
  while (l.length > 1 && medir(`${l}…`) > ancho) l = l.slice(0, -1).trimEnd();
  return `${l}…`;
}

export const AVISO_TEXTO_CORTADO = "Texto completo en la página de la muestra (QR)";

export type TextoDelCartel = {
  size: number;
  lineas: string[];
  /** true si no entró ni con la letra mínima: se cortó con "…" y va el aviso del QR debajo. */
  cortado: boolean;
  avisoSize: number;
  /** Alto total del bloque (texto más aviso), para centrarlo en el hueco. */
  altoBloque: number;
};

/**
 * La letra más grande que llena el hueco (de 26 a 11 pt, por la escala del papel). Con un texto
 * corto la letra crece; si ni con 11 pt entra, se corta con "…" (nunca un "…" solo en una línea
 * vacía) y se suma el aviso de que el texto completo está en la página.
 */
export function textoDelCartel(texto: string, ancho: number, alto: number, e: number, medirCon: (size: number) => (s: string) => number): TextoDelCartel {
  const tamanos = Array.from({ length: 16 }, (_, i) => (26 - i) * e);
  const altoDe = (n: number, size: number) => n * size * INTERLINEA;
  const size = largestThatFits(tamanos, (s) => altoDe(lineasConParrafos(texto, ancho, medirCon(s)).length, s) <= alto);
  const lineas = lineasConParrafos(texto, ancho, medirCon(size));
  const avisoSize = 10 * e;
  if (altoDe(lineas.length, size) <= alto) return { size, lineas, cortado: false, avisoSize, altoBloque: altoDe(lineas.length, size) };
  const altoAviso = size * 0.6 + avisoSize * INTERLINEA;
  let max = Math.max(1, Math.floor((alto - altoAviso) / (size * INTERLINEA)));
  while (max > 1 && lineas[max - 1] === "") max -= 1;
  const cortadas = [...lineas.slice(0, max - 1), conPuntos(lineas[max - 1] ?? "", ancho, medirCon(size))];
  return { size, lineas: cortadas, cortado: true, avisoSize, altoBloque: altoDe(cortadas.length, size) + altoAviso };
}

/**
 * Cartel de sala (D6): título, organiza, curaduría, el texto curatorial con la letra más grande
 * que entra, y al pie fechas, horarios, sede y QR a la muestra. Una sola página vertical.
 */
export async function pdfDeCartel(d: DatosCartel, tamano: PosterSize, fecha: Date): Promise<Uint8Array> {
  const t = POSTER_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 297; // A3 = 1: todo crece con el papel.
  const m = t.width * 0.08 * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Cartel: ${d.titulo}`, fecha);
  const f = await cargarFuentes(pdf);
  const p = pdf.addPage([W, H]);

  // Arriba: título, organiza y curaduría, y una línea fina.
  let y = bloque(p, d.titulo, { x: m, y: H - m, ancho: util, size: 40 * e, font: f.negrita, color: TINTA, maxLineas: 3, interlinea: 1.05 });
  if (d.organizan) y = bloque(p, d.organizan, { x: m, y: y - 8 * e, ancho: util, size: 14 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  if (d.curaduria) y = bloque(p, d.curaduria, { x: m, y: y - 2 * e, ancho: util, size: 14 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  y -= 10 * e * MM;
  p.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.6, color: LINEA });

  // Abajo: el QR a la derecha y los datos a su izquierda.
  const lado = t.width * 0.17 * MM;
  dibujarQr(p, d.url, W - m - lado, m, lado);
  const anchoPie = util - lado - 8 * MM * e;
  let yp = bloque(p, d.fechas, { x: m, y: m + lado, ancho: anchoPie, size: 15 * e, font: f.negrita, color: TINTA, maxLineas: 2 });
  if (d.horarios) yp = bloque(p, d.horarios, { x: m, y: yp - 2 * e, ancho: anchoPie, size: 12 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  if (d.lugar) yp = bloque(p, d.lugar, { x: m, y: yp - 2 * e, ancho: anchoPie, size: 12 * e, font: f.normal, color: TINTA, maxLineas: 3 });
  bloque(p, "Escaneá el código para ver las obras online", { x: m, y: yp - 6 * e, ancho: anchoPie, size: 10 * e, font: f.normal, color: GRIS, maxLineas: 2 });

  // En el medio, el texto curatorial con la letra más grande que entra, centrado en el hueco.
  if (d.texto) {
    const arriba = y - 8 * MM * e;
    const abajo = m + lado + 12 * MM * e;
    const alto = arriba - abajo;
    const medir = (size: number) => (s: string) => f.normal.widthOfTextAtSize(s, size);
    const tx = textoDelCartel(d.texto, util, alto, e, medir);
    const y0 = arriba - Math.max(0, (alto - tx.altoBloque) / 2);
    const yFin = dibujarLineas(p, tx.lineas, { x: m, y: y0, size: tx.size, font: f.normal, color: TINTA, interlinea: INTERLINEA });
    if (tx.cortado) {
      bloque(p, AVISO_TEXTO_CORTADO, { x: m, y: yFin - tx.size * 0.6, ancho: util, size: tx.avisoSize, font: f.normal, color: GRIS, maxLineas: 1, interlinea: INTERLINEA });
    }
  }
  return pdf.save();
}
