import { PDFDocument, type PDFPage } from "pdf-lib";
import { GRIS, LINEA, MM, TINTA, bloque, cargarFuentes, dibujarQr, type Fuentes } from "@/lib/piezas/dibujo";
import { paraWinAnsi, type FichaDeObra } from "./texto";

// Lo común de los PDF vive en `lib/piezas/dibujo.ts`; se reexporta para quien ya lo usaba de acá.
export { MM, tramosOscuros } from "@/lib/piezas/dibujo";

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

export async function pdfDeFichas(fichas: FichaDeObra[], tamano: TamanoFicha): Promise<Uint8Array> {
  if (fichas.length === 0) throw new Error("No hay obras para imprimir.");
  const t = TAMANOS[tamano];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fichas de sala: ${paraWinAnsi(fichas[0]!.muestra)}`);
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  const fuentes = await cargarFuentes(pdf);
  for (const f of fichas) dibujarFicha(pdf.addPage([t.ancho * MM, t.alto * MM]), f, t, fuentes);
  return pdf.save();
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
  dibujarQr(p, f.url, m, m, lado);
  const xTexto = m + lado + 4 * MM;
  const anchoTexto = ancho - m - xTexto;
  const yInvitacion = bloque(p, "Escaneá para ver la obra y a su autor", {
    x: xTexto, y: m + lado, ancho: anchoTexto, size: t.detalle, font: normal, color: TINTA, maxLineas: 3,
  });
  bloque(p, "muestrasfotograficas.com", {
    x: xTexto, y: yInvitacion - t.detalle * 0.4, ancho: anchoTexto, size: t.detalle * 0.85, font: normal, color: GRIS, maxLineas: 2,
  });
}
