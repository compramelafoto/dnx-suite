import { PDFDocument } from "pdf-lib";
import { GUESTBOOK_POSTER_SIZES, type GuestbookPosterSize } from "@repo/muestras";
import { GRIS, MM, TINTA, altoDeBloque, bloqueCentrado, cargarFuentes, dibujarQr, prepararDocumento } from "./dibujo";

export type DatosAficheLibro = { muestra: string; url: string; urlVisible: string };

const SUBTITULO = "Contanos qué te pareció la muestra";
const ESCANEA = "Escaneá con la cámara de tu teléfono";

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
  // Título, subtítulo, QR pegado debajo y los textos: un solo bloque centrado en el alto que
  // queda sobre la dirección del pie, sin huecos en el medio.
  const titulo = { ancho: util, size: 40 * e, font: f.negrita, maxLineas: 1 };
  const subtitulo = { ancho: util, size: 16 * e, font: f.normal, maxLineas: 2 };
  const escanea = { ancho: util, size: 13 * e, font: f.normal, maxLineas: 1 };
  const muestra = { ancho: util, size: 12 * e, font: f.negrita, maxLineas: 2 };
  const lado = W * 0.55;
  const gapChico = 4 * e;
  const gapQr = 8 * e * MM;
  const alto =
    altoDeBloque("Libro de visitas", titulo) + gapChico + altoDeBloque(SUBTITULO, subtitulo) + gapQr + lado + gapQr * 0.75 +
    altoDeBloque(ESCANEA, escanea) + gapChico + altoDeBloque(d.muestra, muestra);
  const pie = m + 10 * e + 2 * 10 * e * 1.2;
  const yArriba = H - m - Math.max(0, (H - m - pie - alto) / 2);
  let y = bloqueCentrado(p, "Libro de visitas", { x: m, y: yArriba, color: TINTA, ...titulo });
  y = bloqueCentrado(p, SUBTITULO, { x: m, y: y - gapChico, color: TINTA, ...subtitulo });
  const yQr = y - gapQr - lado;
  dibujarQr(p, d.url, (W - lado) / 2, yQr, lado);
  y = bloqueCentrado(p, ESCANEA, { x: m, y: yQr - gapQr * 0.75, color: TINTA, ...escanea });
  bloqueCentrado(p, d.muestra, { x: m, y: y - gapChico, color: GRIS, ...muestra });
  bloqueCentrado(p, d.urlVisible, { x: m, y: m + 10 * e, ancho: util, size: 10 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  return pdf.save();
}
