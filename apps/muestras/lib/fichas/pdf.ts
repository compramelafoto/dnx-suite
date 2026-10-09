import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import { matrizDelQr } from "./qr";
import { cortarEnLineas, paraWinAnsi, type FichaDeObra } from "./texto";

/** Puntos PDF por milímetro. */
export const MM = 72 / 25.4;

/**
 * Medidas de cada tamaño (milímetros para el papel, puntos para la letra). Una ficha por página
 * y al tamaño final: cualquier imprenta la imprime y corta sin armar pliegos. Fondo blanco, así
 * que no hace falta sangrado.
 */
export const TAMANOS = {
  A6: { ancho: 105, alto: 148, margen: 9, qr: 32, muestra: 8, titulo: 16, autor: 11, detalle: 9 },
  A5: { ancho: 148, alto: 210, margen: 13, qr: 44, muestra: 10, titulo: 22, autor: 15, detalle: 12 },
} as const;
export type TamanoFicha = keyof typeof TAMANOS;
type Medidas = (typeof TAMANOS)[TamanoFicha];

export function esTamanoFicha(v: unknown): v is TamanoFicha {
  return v === "A6" || v === "A5";
}

// Los colores del sitio: tinta, grafito y línea.
const TINTA = rgb(0x1c / 255, 0x2b / 255, 0x35 / 255);
const GRIS = rgb(0x5b / 255, 0x66 / 255, 0x70 / 255);
const LINEA = rgb(0xe4 / 255, 0xe7 / 255, 0xe9 / 255);
const NEGRO = rgb(0, 0, 0);

type Fuentes = { normal: PDFFont; negrita: PDFFont };

export async function pdfDeFichas(fichas: FichaDeObra[], tamano: TamanoFicha): Promise<Uint8Array> {
  if (fichas.length === 0) throw new Error("No hay obras para imprimir.");
  const t = TAMANOS[tamano];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fichas de sala: ${paraWinAnsi(fichas[0]!.muestra)}`);
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  const fuentes: Fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  for (const f of fichas) dibujarFicha(pdf.addPage([t.ancho * MM, t.alto * MM]), f, t, fuentes);
  return pdf.save();
}

/** Escribe un bloque de texto desde `y` hacia abajo y devuelve dónde terminó. */
function bloque(
  p: PDFPage,
  texto: string,
  o: { x: number; y: number; ancho: number; size: number; font: PDFFont; color: Color; maxLineas: number; interlinea?: number },
): number {
  const lineas = cortarEnLineas(paraWinAnsi(texto), o.ancho, (s) => o.font.widthOfTextAtSize(s, o.size), o.maxLineas);
  let y = o.y;
  for (const l of lineas) {
    y -= o.size * (o.interlinea ?? 1.2);
    p.drawText(l, { x: o.x, y, size: o.size, font: o.font, color: o.color });
  }
  return y;
}

function dibujarFicha(p: PDFPage, f: FichaDeObra, t: Medidas, { normal, negrita }: Fuentes) {
  const ancho = t.ancho * MM;
  const alto = t.alto * MM;
  const m = t.margen * MM;
  const util = ancho - 2 * m;

  // Arriba, la muestra: chica, en gris, con una línea fina debajo.
  let y = bloque(p, f.muestra, { x: m, y: alto - m, ancho: util, size: t.muestra, font: normal, color: GRIS, maxLineas: 2 });
  y -= t.muestra * 0.9;
  p.drawLine({ start: { x: m, y }, end: { x: ancho - m, y }, thickness: 0.5, color: LINEA });
  y -= t.titulo * 0.6;
  // El título manda: negrita y grande, hasta tres líneas.
  y = bloque(p, f.titulo, { x: m, y, ancho: util, size: t.titulo, font: negrita, color: TINTA, maxLineas: 3, interlinea: 1.1 });
  y -= t.autor * 0.5;
  y = bloque(p, f.autor, { x: m, y, ancho: util, size: t.autor, font: normal, color: TINTA, maxLineas: 2 });
  if (f.detalle) {
    y -= t.detalle * 0.3;
    bloque(p, f.detalle, { x: m, y, ancho: util, size: t.detalle, font: normal, color: GRIS, maxLineas: 2 });
  }

  // Abajo a la izquierda el QR; a su derecha, la invitación.
  const lado = t.qr * MM;
  dibujarQr(p, matrizDelQr(f.url), m, m, lado);
  const xTexto = m + lado + 4 * MM;
  const anchoTexto = ancho - m - xTexto;
  const yInvitacion = bloque(p, "Escaneá para ver la obra y a su autor", {
    x: xTexto, y: m + lado, ancho: anchoTexto, size: t.detalle, font: normal, color: TINTA, maxLineas: 3,
  });
  bloque(p, "muestrasfotograficas.com", {
    x: xTexto, y: yInvitacion - t.detalle * 0.4, ancho: anchoTexto, size: t.detalle * 0.85, font: normal, color: GRIS, maxLineas: 2,
  });
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
 * El QR como rectángulos vectoriales: uno por tramo de módulos negros seguidos (se ve igual que un
 * cuadradito por módulo y el PDF pesa bastante menos). La matriz se lee de arriba abajo y el PDF
 * mide desde abajo.
 */
function dibujarQr(p: PDFPage, modulos: boolean[][], x: number, y: number, lado: number) {
  const n = modulos.length;
  const mod = lado / n;
  for (const t of tramosOscuros(modulos)) {
    p.drawRectangle({ x: x + t.col * mod, y: y + (n - 1 - t.fila) * mod, width: t.largo * mod, height: mod, color: NEGRO });
  }
}
