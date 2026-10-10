import { PDFDocument } from "pdf-lib";
import { formatCm, frameLayout, type FrameSize, type Orientation } from "@repo/muestras";
import { GRIS, MM, TINTA, bloqueCentrado, cargarFuentes, lineaPunteada, prepararDocumento } from "./dibujo";
import type { ImagenPdf } from "./imagen";

export type ObraParaMarco = { titulo: string; autor: string; detalle: string | null; imagen: ImagenPdf | null };
export type OpcionesMarco = { tamano: FrameSize; orientacion: Orientation; conFoto: boolean };

const mm = (n: number) => n * MM;

/**
 * Marco / remarco de cada obra (D3): la foto entera con su margen blanco y, debajo, título y
 * autor. "Sólo el remarco" (`conFoto: false`) deja la ventana marcada con línea punteada, a la
 * medida de la foto, para usar con una copia propia.
 */
export async function pdfDeMarcos(muestra: string, obras: ObraParaMarco[], o: OpcionesMarco, fecha: Date): Promise<Uint8Array> {
  if (obras.length === 0) throw new Error("No hay obras para imprimir.");
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Marcos: ${muestra}`, fecha);
  const f = await cargarFuentes(pdf);
  for (const obra of obras) {
    const l = frameLayout(o.tamano, o.orientacion, obra.imagen ? { width: obra.imagen.width, height: obra.imagen.height } : null);
    const p = pdf.addPage([mm(l.page.width), mm(l.page.height)]);
    const caja = { x: mm(l.image.x), y: mm(l.image.y), width: mm(l.image.width), height: mm(l.image.height) };
    if (o.conFoto && obra.imagen) {
      p.drawImage(await pdf.embedJpg(obra.imagen.jpg), caja);
    } else {
      lineaPunteada(p, caja);
      const medida = `Ventana de ${formatCm(Math.round(l.image.width) / 10)} × ${formatCm(Math.round(l.image.height) / 10)} cm`;
      bloqueCentrado(p, medida, { x: caja.x, y: caja.y + caja.height / 2 + 6, ancho: caja.width, size: 9, font: f.normal, color: GRIS, maxLineas: 1 });
    }
    // Título y autor centrados debajo de la foto, dentro de los márgenes.
    const pie = { x: mm(l.window.x), ancho: mm(l.window.width) };
    let y = bloqueCentrado(p, obra.titulo, { ...pie, y: mm(l.captionTop), size: l.titleSizePt, font: f.negrita, color: TINTA, maxLineas: 2, interlinea: 1.15 });
    y = bloqueCentrado(p, obra.autor, { ...pie, y: y - l.authorSizePt * 0.2, size: l.authorSizePt, font: f.normal, color: TINTA, maxLineas: 1 });
    if (obra.detalle) bloqueCentrado(p, obra.detalle, { ...pie, y, size: l.authorSizePt * 0.85, font: f.normal, color: GRIS, maxLineas: 1 });
  }
  return pdf.save();
}
