import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import { DEFAULT_WALL_HEIGHT_CM, formatCm } from "@repo/muestras";
import { ALERTA, GRIS, LINEA, MM, TINTA, bloque, bloqueCentrado, cargarFuentes, lineaPunteada, prepararDocumento, type Fuentes } from "./dibujo";
import type { DatosMontaje, ParedParaPdf } from "./textos";

const W = 297 * MM;
const H = 210 * MM;
const M = 12 * MM;
const FILA = 6.5 * MM;
const BLANCO = rgb(1, 1, 1);
// Anchos en mm; suman 273 (A4 apaisado menos márgenes).
const COLUMNAS = [
  { titulo: "N.º", ancho: 12 }, { titulo: "Obra", ancho: 70 }, { titulo: "Autor", ancho: 55 }, { titulo: "Marco", ancho: 32 },
  { titulo: "Centro desde el borde izq.", ancho: 42 }, { titulo: "Borde superior", ancho: 42 }, { titulo: "Colgada", ancho: 20 },
] as const;
// La lista de control no lleva medidas para colgar: la primera columna tiene lugar para el nombre de la pared.
const COLUMNAS_CONTROL = [
  { titulo: "Pared y n.º", ancho: 48 }, { titulo: "Obra", ancho: 90 }, { titulo: "Autor", ancho: 70 }, { titulo: "Marco", ancho: 40 },
  { titulo: "Colgada", ancho: 25 },
] as const;
type Columna = { titulo: string; ancho: number };

/**
 * Plano y lista de montaje (D10): por pared, el alzado a escala (piso, línea de centro, marcos
 * numerados) y la tabla con lo que se mide para colgar; al final, la lista de control.
 */
export async function pdfDeMontaje(d: DatosMontaje, fecha: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Plano de montaje: ${d.muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  const pagina = (titulo: string) => {
    const p = pdf.addPage([W, H]);
    bloque(p, titulo, { x: M, y: H - M, ancho: W - 2 * M, size: 14, font: f.negrita, color: TINTA, maxLineas: 1 });
    bloque(p, `${d.muestra} · Línea de centro a ${formatCm(d.centroCm)} cm del piso`, { x: M, y: H - M - 18, ancho: W - 2 * M, size: 8, font: f.normal, color: GRIS, maxLineas: 1 });
    return p;
  };

  for (const pared of d.paredes) {
    const p = pagina(`Pared: ${pared.nombre} (${formatCm(pared.anchoCm)} cm)`);
    let y = dibujarPared(p, pared, d.centroCm, f);
    for (const aviso of pared.layout.warnings) y = bloque(p, aviso, { x: M, y, ancho: W - 2 * M, size: 8, font: f.normal, color: ALERTA, maxLineas: 2 });
    filas(p, y - 4, COLUMNAS, pared.obras.map((o) => [String(o.numero), o.titulo, o.autor, o.marco, o.centroDesdeIzquierda, o.bordeSuperior, ""]), f, () => pagina(`Pared: ${pared.nombre} (sigue)`));
  }

  // Lista de control: todo junto, por pared, más lo que no tiene pared.
  const p = pagina("Lista de control");
  const control = d.paredes.flatMap((w) => w.obras.map((o) => [`${w.nombre} ${o.numero}`, o.titulo, o.autor, o.marco, ""]));
  const sin = d.sinPared.map((o) => ["Sin pared", o.titulo, o.autor, "", ""]);
  filas(p, H - M - 34, COLUMNAS_CONTROL, [...control, ...sin], f, () => pagina("Lista de control (sigue)"));
  return pdf.save();
}

/** Dibuja la pared a escala debajo del encabezado; devuelve dónde termina (en puntos). */
function dibujarPared(p: PDFPage, pared: ParedParaPdf, centroCm: number, f: Fuentes): number {
  const arriba = H - M - 34;
  const altoZona = 80 * MM;
  const piso = arriba - altoZona;
  const maxTop = Math.max(0, ...pared.layout.positions.map((x) => x.topCm));
  const altoCm = pared.altoCm ?? Math.max(DEFAULT_WALL_HEIGHT_CM, maxTop + 20);
  // Nunca cero: un plano guardado a mano con una pared sin ancho no tiene que romper la escala.
  const anchoCm = Math.max(pared.anchoCm, pared.layout.framesCm, 1);
  const s = Math.min((W - 2 * M) / anchoCm, altoZona / altoCm); // puntos por cm
  lineaPunteada(p, { x: M, y: piso, width: pared.anchoCm * s, height: altoCm * s }, LINEA);
  p.drawLine({ start: { x: M, y: piso }, end: { x: M + anchoCm * s, y: piso }, thickness: 1.2, color: TINTA });
  const yCentro = piso + centroCm * s;
  p.drawLine({ start: { x: M, y: yCentro }, end: { x: M + pared.anchoCm * s, y: yCentro }, thickness: 0.5, color: GRIS, dashArray: [4, 2] });
  // La leyenda va a la derecha de la pared si hay lugar; si no, arriba de la línea (los marcos, blancos, la tapan donde se cruzan).
  const leyenda = `Centro a ${formatCm(centroCm)} cm`;
  const finPared = M + pared.anchoCm * s;
  const xLeyenda = W - M - finPared > f.normal.widthOfTextAtSize(leyenda, 6.5) + 8 ? finPared + 4 : M + 2;
  p.drawText(leyenda, { x: xLeyenda, y: yCentro + (xLeyenda === M + 2 ? 2 : -2), size: 6.5, font: f.normal, color: GRIS });
  for (const x of pared.layout.positions) {
    const caja = { x: M + x.leftCm * s, y: piso + Math.max(0, x.bottomCm) * s, width: x.widthCm * s, height: (x.topCm - Math.max(0, x.bottomCm)) * s };
    p.drawRectangle({ ...caja, color: BLANCO, borderColor: TINTA, borderWidth: 0.8 });
    const size = Math.min(10, caja.height * 0.5, caja.width * 0.6);
    // `bloqueCentrado` escribe la línea debajo de `y`: así el número queda centrado en el marco.
    bloqueCentrado(p, String(x.number), { x: caja.x, y: caja.y + caja.height / 2 + size * 0.85, ancho: caja.width, size, font: f.negrita, color: TINTA, maxLineas: 1 });
  }
  return piso - 10;
}

/** Tabla con encabezado; sigue en páginas nuevas si no entra. */
function filas(primera: PDFPage, desde: number, columnas: readonly Columna[], datos: string[][], f: Fuentes, otra: () => PDFPage) {
  let p = primera;
  let y = desde;
  const encabezado = () => {
    let x = M;
    for (const c of columnas) {
      bloque(p, c.titulo, { x: x + 2, y, ancho: c.ancho * MM - 4, size: 7, font: f.negrita, color: GRIS, maxLineas: 1 });
      x += c.ancho * MM;
    }
    y -= FILA;
    p.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LINEA });
  };
  encabezado();
  for (const fila of datos) {
    if (y - FILA < M) {
      p = otra();
      y = H - M - 34;
      encabezado();
    }
    let x = M;
    fila.forEach((celda, i) => {
      const c = columnas[i]!;
      if (c.titulo === "Colgada") p.drawRectangle({ x: x + 6, y: y - FILA + 6, width: 9, height: 9, borderColor: TINTA, borderWidth: 0.6 });
      else bloque(p, celda, { x: x + 2, y, ancho: c.ancho * MM - 4, size: 8, font: f.normal, color: TINTA, maxLineas: 1 });
      x += c.ancho * MM;
    });
    y -= FILA;
    p.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.3, color: LINEA });
  }
}
