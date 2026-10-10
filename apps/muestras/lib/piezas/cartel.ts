import { PDFDocument, type PDFFont } from "pdf-lib";
import { POSTER_SIZES, largestThatFits, type PosterSize } from "@repo/muestras";
import { GRIS, LINEA, MM, TINTA, bloque, cargarFuentes, dibujarLineas, dibujarQr, lineasConParrafos, prepararDocumento } from "./dibujo";
import type { DatosCartel } from "./textos";

const INTERLINEA = 1.35;

/** Recorta la última línea para que entre con "…" al final. */
function conPuntos(linea: string, ancho: number, font: PDFFont, size: number): string {
  let l = linea;
  while (l.length > 1 && font.widthOfTextAtSize(`${l}…`, size) > ancho) l = l.slice(0, -1).trimEnd();
  return `${l}…`;
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

  // En el medio, el texto curatorial con la letra más grande que entra.
  if (d.texto) {
    const arriba = y - 8 * MM * e;
    const abajo = m + lado + 12 * MM * e;
    const alto = arriba - abajo;
    const medir = (size: number) => (s: string) => f.normal.widthOfTextAtSize(s, size);
    const tamanos = [18, 16, 15, 14, 13, 12, 11, 10, 9].map((s) => s * e);
    const size = largestThatFits(tamanos, (s) => lineasConParrafos(d.texto!, util, medir(s)).length * s * INTERLINEA <= alto);
    let lineas = lineasConParrafos(d.texto, util, medir(size));
    const max = Math.max(1, Math.floor(alto / (size * INTERLINEA)));
    if (lineas.length > max) lineas = [...lineas.slice(0, max - 1), conPuntos(lineas[max - 1] ?? "", util, f.normal, size)];
    dibujarLineas(p, lineas, { x: m, y: arriba, size, font: f.normal, color: TINTA, interlinea: INTERLINEA });
  }
  return pdf.save();
}
