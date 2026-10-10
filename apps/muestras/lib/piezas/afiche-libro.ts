import { PDFDocument } from "pdf-lib";
import { GUESTBOOK_POSTER_SIZES, type GuestbookPosterSize } from "@repo/muestras";
import { GRIS, MM, TINTA, bloqueCentrado, cargarFuentes, dibujarQr, prepararDocumento } from "./dibujo";

export type DatosAficheLibro = { muestra: string; url: string; urlVisible: string };

/** Afiche del libro de visitas: grande, con un QR que se lee de lejos. */
export async function pdfDeAficheLibro(d: DatosAficheLibro, tamano: GuestbookPosterSize, fecha: Date): Promise<Uint8Array> {
  const t = GUESTBOOK_POSTER_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 210; // A4 = 1
  const m = 18 * e * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Libro de visitas: ${d.muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  const p = pdf.addPage([W, H]);
  let y = bloqueCentrado(p, "Libro de visitas", { x: m, y: H - m, ancho: util, size: 40 * e, font: f.negrita, color: TINTA, maxLineas: 1 });
  bloqueCentrado(p, "Contanos qué te pareció la muestra", { x: m, y: y - 4 * e, ancho: util, size: 16 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  const lado = W * 0.55;
  const yQr = (H - lado) / 2 - 6 * e * MM;
  dibujarQr(p, d.url, (W - lado) / 2, yQr, lado);
  y = bloqueCentrado(p, "Escaneá con la cámara de tu teléfono", { x: m, y: yQr - 6 * e, ancho: util, size: 13 * e, font: f.normal, color: TINTA, maxLineas: 1 });
  bloqueCentrado(p, d.muestra, { x: m, y: y - 4 * e, ancho: util, size: 12 * e, font: f.negrita, color: GRIS, maxLineas: 2 });
  bloqueCentrado(p, d.urlVisible, { x: m, y: m + 10 * e, ancho: util, size: 10 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  return pdf.save();
}
