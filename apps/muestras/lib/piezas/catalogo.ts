import { PDFDocument, type PDFPage } from "pdf-lib";
import { CATALOG_SIZES, NO_AUTHOR, authorIndex, catalogPlan, fitInside, type CatalogSize } from "@repo/muestras";
import { paraWinAnsi } from "@/lib/fichas/texto";
import { GRIS, LINEA, MM, TINTA, bloque, bloqueCentrado, cargarFuentes, dibujarLineas, dibujarQr, lineasConParrafos, prepararDocumento, type Fuentes } from "./dibujo";
import type { ImagenPdf } from "./imagen";
import type { DatosCartel } from "./textos";

export type ObraCatalogo = { titulo: string; autor: string; detalle: string | null; imagen: ImagenPdf | null };
export type DatosCatalogo = Omit<DatosCartel, "horarios"> & { horarios?: string | null; urlVisible: string; portada: ImagenPdf | null; obras: ObraCatalogo[] };

const INTERLINEA = 1.4;

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Catálogo (D7): portada, texto curatorial, una página por obra (todas, en el orden de la
 * galería), índice de autores y una página final con QR. Números de página desde la 2.
 */
export async function pdfDeCatalogo(d: DatosCatalogo, tamano: CatalogSize, fecha: Date): Promise<Uint8Array> {
  if (d.obras.length === 0) throw new Error("No hay obras para el catálogo.");
  const t = CATALOG_SIZES[tamano];
  const W = t.width * MM;
  const H = t.height * MM;
  const e = t.width / 148; // A5 = 1
  const m = t.width * 0.1 * MM;
  const util = W - 2 * m;
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Catálogo: ${d.titulo}`, fecha);
  const f = await cargarFuentes(pdf);

  // Primero se cortan texto e índice: de eso dependen los números de página.
  const cuerpo = 10 * e;
  const lineasPorPagina = Math.floor((H - 2 * m - 30 * e) / (cuerpo * INTERLINEA));
  const lineasTexto = d.texto
    ? [...lineasConParrafos(d.texto, util, (s) => f.normal.widthOfTextAtSize(s, cuerpo)), ...(d.curaduria ? ["", paraWinAnsi(d.curaduria)] : [])]
    : [];
  const paginasTexto = trozos(lineasTexto, lineasPorPagina);
  const primeraObra = 2 + paginasTexto.length;
  const indice = authorIndex(d.obras.map((o, i) => ({ authorName: o.autor, page: primeraObra + i })));
  const paginasIndice = trozos(indice, lineasPorPagina);
  const plan = catalogPlan(paginasTexto.length, d.obras.length, paginasIndice.length);

  const nueva = (n: number) => {
    const p = pdf.addPage([W, H]);
    if (n > 1) bloqueCentrado(p, String(n), { x: m, y: m * 0.75, ancho: util, size: 8 * e, font: f.normal, color: GRIS, maxLineas: 1 });
    return p;
  };
  const encabezado = (p: PDFPage, texto: string) =>
    bloque(p, texto, { x: m, y: H - m, ancho: util, size: 14 * e, font: f.negrita, color: TINTA, maxLineas: 1 }) - 10 * e;

  portada(nueva(1), d, { H, m, util, e }, f, await (d.portada ? pdf.embedJpg(d.portada.jpg) : null));

  paginasTexto.forEach((lineas, i) => {
    const p = nueva(2 + i);
    const y = i === 0 ? encabezado(p, "Texto curatorial") : H - m;
    dibujarLineas(p, lineas, { x: m, y, size: cuerpo, font: f.normal, color: TINTA, interlinea: INTERLINEA });
  });

  for (const [i, o] of d.obras.entries()) {
    const p = nueva(plan.firstWorkPage + i);
    const caja = { x: m, y: H * 0.3, width: util, height: H - m - H * 0.3 };
    // El pie va pegado debajo de la foto (una apaisada queda centrada en la caja, más arriba).
    let bordeInferior = caja.y;
    if (o.imagen) {
      const lugar = fitInside(caja, o.imagen);
      p.drawImage(await pdf.embedJpg(o.imagen.jpg), lugar);
      bordeInferior = lugar.y;
    } else {
      p.drawRectangle({ ...caja, borderColor: LINEA, borderWidth: 0.6 });
      bloqueCentrado(p, "Imagen no disponible", { x: caja.x, y: caja.y + caja.height / 2, ancho: caja.width, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 1 });
    }
    let y = bloque(p, o.titulo, { x: m, y: bordeInferior - 4 * MM * e, ancho: util, size: 13 * e, font: f.negrita, color: TINTA, maxLineas: 2 });
    y = bloque(p, o.autor.trim() || NO_AUTHOR, { x: m, y, ancho: util, size: 11 * e, font: f.normal, color: TINTA, maxLineas: 1 });
    if (o.detalle) bloque(p, o.detalle, { x: m, y, ancho: util, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  }

  (paginasIndice.length ? paginasIndice : [[]]).forEach((entradas, i) => {
    const p = nueva(plan.indexFirstPage + i);
    let y = i === 0 ? encabezado(p, "Índice de autores") : H - m;
    for (const ent of entradas) {
      y -= cuerpo * INTERLINEA;
      const paginas = ent.pages.join(", ");
      const anchoPag = f.normal.widthOfTextAtSize(paginas, cuerpo);
      bloque(p, ent.author, { x: m, y: y + cuerpo * 1.2, ancho: util - anchoPag - 6 * e, size: cuerpo, font: f.normal, color: TINTA, maxLineas: 1 });
      p.drawText(paginas, { x: W - m - anchoPag, y, size: cuerpo, font: f.normal, color: GRIS });
    }
  });

  // Cierre: QR a la muestra.
  const p = nueva(plan.closingPage);
  const lado = 45 * e * MM;
  const yQr = (H - lado) / 2;
  bloqueCentrado(p, "Las obras, online", { x: m, y: yQr + lado + 14 * e + 13 * e, ancho: util, size: 13 * e, font: f.negrita, color: TINTA, maxLineas: 1 });
  dibujarQr(p, d.url, (W - lado) / 2, yQr, lado);
  bloqueCentrado(p, d.urlVisible, { x: m, y: yQr - 4 * e, ancho: util, size: 9 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  return pdf.save();
}

function portada(
  p: PDFPage, d: DatosCatalogo, g: { H: number; m: number; util: number; e: number }, f: Fuentes,
  img: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null,
) {
  const { H, m, util, e } = g;
  let y = H - m - H * 0.2;
  if (img && d.portada) {
    const caja = fitInside({ x: m, y: H * 0.42, width: util, height: H - m - H * 0.42 }, d.portada);
    p.drawImage(img, caja);
    y = H * 0.42 - 8 * e * MM;
  }
  y = bloque(p, d.titulo, { x: m, y, ancho: util, size: 22 * e, font: f.negrita, color: TINTA, maxLineas: 3, interlinea: 1.1 });
  if (d.organizan) y = bloque(p, d.organizan, { x: m, y: y - 4 * e, ancho: util, size: 11 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  if (d.curaduria) y = bloque(p, d.curaduria, { x: m, y, ancho: util, size: 11 * e, font: f.normal, color: GRIS, maxLineas: 2 });
  y = bloque(p, d.fechas, { x: m, y: y - 6 * e, ancho: util, size: 11 * e, font: f.normal, color: TINTA, maxLineas: 2 });
  if (d.lugar) bloque(p, d.lugar, { x: m, y, ancho: util, size: 10 * e, font: f.normal, color: TINTA, maxLineas: 3 });
}
