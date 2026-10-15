import { StandardFonts, rgb, type Color, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { matrizDelQr } from "@/lib/fichas/qr";
import { cortarEnLineas, paraWinAnsi } from "@/lib/fichas/texto";

/** Puntos PDF por milímetro. */
export const MM = 72 / 25.4;

// Los colores del sitio: tinta, grafito, línea y el rojo de los avisos.
export const TINTA = rgb(0x1c / 255, 0x2b / 255, 0x35 / 255);
export const GRIS = rgb(0x5b / 255, 0x66 / 255, 0x70 / 255);
export const LINEA = rgb(0xe4 / 255, 0xe7 / 255, 0xe9 / 255);
export const NEGRO = rgb(0, 0, 0);
export const ALERTA = rgb(0xa1 / 255, 0x25 / 255, 0x1b / 255);

export type Fuentes = { normal: PDFFont; negrita: PDFFont };

/**
 * Título, autoría y fechas fijas: con la misma fecha (la `updatedAt` de la muestra) el mismo
 * contenido da los mismos bytes, y en R2 no se acumulan copias iguales (D4).
 */
export function prepararDocumento(pdf: PDFDocument, titulo: string, fecha: Date) {
  pdf.setTitle(paraWinAnsi(titulo));
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  pdf.setCreationDate(fecha);
  pdf.setModificationDate(fecha);
}

export async function cargarFuentes(pdf: PDFDocument): Promise<Fuentes> {
  return { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) };
}

type OpcionesTexto = { x: number; y: number; ancho: number; size: number; font: PDFFont; color: Color; maxLineas: number; interlinea?: number };

/** Escribe un bloque de texto desde `y` hacia abajo y devuelve dónde terminó. (Igual que en las fichas.) */
export function bloque(p: PDFPage, texto: string, o: OpcionesTexto): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/** Lo que va a ocupar `bloque` (o `bloqueCentrado`) con esas opciones, sin dibujar nada. */
export function altoDeBloque(texto: string, o: Omit<OpcionesTexto, "x" | "y" | "color">): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  return lineas.length * o.size * (o.interlinea ?? 1.2);
}

/** Como `bloque`, pero cada línea centrada en `x + ancho / 2`. */
export function bloqueCentrado(p: PDFPage, texto: string, o: OpcionesTexto): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x + (o.ancho - o.font.widthOfTextAtSize(l, o.size)) / 2, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/**
 * Corta un texto largo respetando sus párrafos (cualquier salto de línea separa párrafo) y deja
 * una línea vacía entre ellos. Sin tope de líneas: quien dibuja decide cuántas entran.
 * Se separa en párrafos ANTES de `paraWinAnsi`, que cambia todo espacio en blanco (también "\n")
 * por un espacio.
 */
export function lineasConParrafos(texto: string, ancho: number, medir: (s: string) => number): string[] {
  const parrafos = texto.replace(/\r\n?/g, "\n").split(/\n+/).map((s) => paraWinAnsi(s).trim()).filter(Boolean);
  return parrafos.flatMap((par, i) => [...(i > 0 ? [""] : []), ...cortarEnLineas(par, ancho, medir, Number.POSITIVE_INFINITY)]);
}

/** Dibuja líneas ya cortadas desde `y` hacia abajo; devuelve dónde terminó. */
export function dibujarLineas(p: PDFPage, lineas: string[], o: { x: number; y: number; size: number; font: PDFFont; color: Color; interlinea?: number }): number {
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.35);
    if (l) p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

/** Los módulos negros de cada fila, juntados en tramos horizontales seguidos. */
export function tramosOscuros(modulos: boolean[][]): { fila: number; col: number; largo: number }[] {
  const tramos: { fila: number; col: number; largo: number }[] = [];
  modulos.forEach((fila, f) => {
    let c = 0;
    while (c < fila.length) {
      if (!fila[c]) { c++; continue; }
      const desde = c;
      while (c < fila.length && fila[c]) c++;
      tramos.push({ fila: f, col: desde, largo: c - desde });
    }
  });
  return tramos;
}

/**
 * El QR de `url` como rectángulos vectoriales, con la esquina inferior izquierda en (x, y): uno
 * por tramo de módulos negros seguidos (se ve igual que un cuadradito por módulo y el PDF pesa
 * bastante menos). La matriz se lee de arriba abajo y el PDF mide desde abajo.
 */
export function dibujarQr(p: PDFPage, url: string, x: number, y: number, lado: number) {
  const modulos = matrizDelQr(url);
  const n = modulos.length;
  const mod = lado / n;
  for (const t of tramosOscuros(modulos)) {
    p.drawRectangle({ x: x + t.col * mod, y: y + (n - 1 - t.fila) * mod, width: t.largo * mod, height: mod, color: NEGRO });
  }
}

/** Un rectángulo de línea punteada fina (la ventana del remarco, el contorno de una pared). */
export function lineaPunteada(p: PDFPage, c: { x: number; y: number; width: number; height: number }, color: Color = GRIS) {
  const esquinas: [number, number][] = [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]];
  esquinas.forEach(([x, y], i) => {
    const [x2, y2] = esquinas[(i + 1) % 4]!;
    p.drawLine({ start: { x, y }, end: { x: x2, y: y2 }, thickness: 0.5, color, dashArray: [3, 3] });
  });
}
