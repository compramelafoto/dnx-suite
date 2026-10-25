import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { CBTE_NOTA_CREDITO_C, CONCEPTO_LABELS, CONDICION_IVA_LABELS, DOC_TIPO_LABELS, type Concepto } from "./constants";
import { aIsoFecha } from "./pedido";

/**
 * El PDF del comprobante (Factura C o Nota de crédito C), con la marca del negocio y el QR de la
 * RG 4892. Módulo PURO: recibe datos y bytes, devuelve bytes. Mismo motor (`pdf-lib`, Helvetica,
 * A4) que el PDF de los contratos.
 */

export type DatosPdf = {
  cbteTipo: number;
  ptoVta: number;
  numero: number;
  /** AAAAMMDD */
  fecha: string;
  concepto: Concepto;
  servicio: { desde: string; hasta: string; vtoPago: string } | null;
  emisor: {
    nombreComercial: string | null;
    razonSocial: string;
    cuit: string;
    ivaCondition: string;
    domicilioFiscal: string;
    ingresosBrutos: string | null;
    inicioActividades: string | null;
  };
  receptor: { docTipo: number; docNro: string; nombre: string; ivaCondition: string; domicilio: string | null };
  renglones: { description: string; qty: number; unitPriceMinor: number; lineTotalMinor: number }[];
  totalMinor: number;
  cae: string;
  caeVto: string;
  asociado: { ptoVta: number; numero: number } | null;
  /** Homologación: lleva la marca «sin validez fiscal». */
  esPrueba: boolean;
  qrPng: Uint8Array;
  logo: { bytes: Uint8Array; tipo: "png" | "jpg" } | null;
};

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const NEGRO = rgb(0.07, 0.07, 0.07);
const GRIS = rgb(0.42, 0.42, 0.42);
const LINEA = rgb(0.78, 0.78, 0.78);

/** Lo que Helvetica (WinAnsi) no puede dibujar se cambia por "?". */
export function textoSeguro(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

export function numeroComprobante(ptoVta: number, numero: number): string {
  return `${String(ptoVta).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;
}

export function pesos(minor: number): string {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const entero = Math.floor(abs / 100).toLocaleString("es-AR");
  return `${neg ? "-" : ""}$ ${entero},${String(abs % 100).padStart(2, "0")}`;
}

function dia(aaaammdd: string): string {
  const iso = aIsoFecha(aaaammdd);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function recortar(t: string, font: PDFFont, size: number, ancho: number): string {
  let s = textoSeguro(t);
  if (font.widthOfTextAtSize(s, size) <= ancho) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > ancho) s = s.slice(0, -1);
  return `${s}...`;
}

export async function armarPdfComprobante(d: DatosPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const nc = d.cbteTipo === CBTE_NOTA_CREDITO_C;
  const titulo = nc ? "NOTA DE CRÉDITO" : "FACTURA";
  pdf.setTitle(`${titulo} C ${numeroComprobante(d.ptoVta, d.numero)}`);
  pdf.setProducer("FOTOFFICE");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qr = await pdf.embedPng(d.qrPng);
  let logo: PDFImage | null = null;
  if (d.logo) {
    try {
      logo = d.logo.tipo === "png" ? await pdf.embedPng(d.logo.bytes) : await pdf.embedJpg(d.logo.bytes);
    } catch {
      logo = null;
    }
  }

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  const t = (p: PDFPage, s: string, x: number, y: number, size = 9, font = regular, color = NEGRO) =>
    p.drawText(textoSeguro(s), { x, y, size, font, color });

  // --- Encabezado: emisor a la izquierda, comprobante a la derecha, la "C" al medio. ---
  const top = A4.h - M;
  const altoCab = 130;
  page.drawRectangle({ x: M, y: top - altoCab, width: A4.w - 2 * M, height: altoCab, borderColor: LINEA, borderWidth: 1 });
  page.drawLine({ start: { x: A4.w / 2, y: top - altoCab }, end: { x: A4.w / 2, y: top - 40 }, color: LINEA, thickness: 1 });
  page.drawRectangle({ x: A4.w / 2 - 22, y: top - 44, width: 44, height: 44, borderColor: NEGRO, borderWidth: 1, color: rgb(1, 1, 1) });
  t(page, "C", A4.w / 2 - 9, top - 30, 26, negrita);
  t(page, nc ? "COD. 013" : "COD. 011", A4.w / 2 - 17, top - 41, 6.5, negrita);

  let yE = top - 20;
  const xE = M + 10;
  if (logo) {
    const escala = Math.min(110 / logo.width, 36 / logo.height);
    page.drawImage(logo, { x: xE, y: yE - logo.height * escala + 8, width: logo.width * escala, height: logo.height * escala });
    yE -= logo.height * escala + 4;
  } else if (d.emisor.nombreComercial) {
    t(page, recortar(d.emisor.nombreComercial, negrita, 14, 200), xE, yE - 6, 14, negrita);
    yE -= 22;
  }
  const anchoMitad = A4.w / 2 - M - 40;
  t(page, recortar(d.emisor.razonSocial, negrita, 10, anchoMitad), xE, yE - 8, 10, negrita);
  t(page, recortar(`Domicilio: ${d.emisor.domicilioFiscal}`, regular, 8, anchoMitad), xE, yE - 22, 8);
  t(page, `Condición frente al IVA: ${CONDICION_IVA_LABELS[d.emisor.ivaCondition] ?? d.emisor.ivaCondition}`, xE, yE - 34, 8);

  const xC = A4.w / 2 + 30;
  t(page, titulo, xC, top - 62, 15, negrita);
  t(page, `Punto de venta: ${String(d.ptoVta).padStart(5, "0")}    Comp. nro: ${String(d.numero).padStart(8, "0")}`, xC, top - 78, 8.5, negrita);
  t(page, `Fecha de emisión: ${dia(d.fecha)}`, xC, top - 91, 8.5);
  t(page, `CUIT: ${d.emisor.cuit}`, xC, top - 103, 8.5);
  t(page, `Ingresos brutos: ${d.emisor.ingresosBrutos ?? d.emisor.cuit}`, xC, top - 114, 8.5);
  if (d.emisor.inicioActividades) {
    const ia = d.emisor.inicioActividades;
    t(page, `Inicio de actividades: ${ia.slice(8, 10)}/${ia.slice(5, 7)}/${ia.slice(0, 4)}`, xC, top - 125, 8.5);
  }
  t(page, "ORIGINAL", M + 10, top - altoCab + 6, 7, negrita, GRIS);

  // --- Período y receptor ---
  let y = top - altoCab - 8;
  if (d.servicio) {
    page.drawRectangle({ x: M, y: y - 20, width: A4.w - 2 * M, height: 20, borderColor: LINEA, borderWidth: 1 });
    t(page, `Período facturado desde: ${dia(d.servicio.desde)}   hasta: ${dia(d.servicio.hasta)}   Vencimiento del pago: ${dia(d.servicio.vtoPago)}`, M + 10, y - 13, 8.5);
    y -= 28;
  }
  const altoRec = 50;
  page.drawRectangle({ x: M, y: y - altoRec, width: A4.w - 2 * M, height: altoRec, borderColor: LINEA, borderWidth: 1 });
  const doc = d.receptor.docNro === "0" ? "Sin identificar" : `${DOC_TIPO_LABELS[d.receptor.docTipo] ?? "Doc."}: ${d.receptor.docNro}`;
  t(page, doc, M + 10, y - 14, 8.5, negrita);
  t(page, recortar(`Apellido y nombre / Razón social: ${d.receptor.nombre}`, regular, 8.5, 330), M + 160, y - 14, 8.5);
  t(page, `Condición frente al IVA: ${CONDICION_IVA_LABELS[d.receptor.ivaCondition] ?? d.receptor.ivaCondition}`, M + 10, y - 28, 8.5);
  t(page, recortar(`Domicilio: ${d.receptor.domicilio ?? "-"}`, regular, 8.5, 330), M + 160, y - 28, 8.5);
  t(page, `Concepto: ${CONCEPTO_LABELS[d.concepto]}`, M + 10, y - 42, 8.5);
  if (d.asociado) t(page, `Corresponde a la Factura C ${numeroComprobante(d.asociado.ptoVta, d.asociado.numero)}`, M + 160, y - 42, 8.5, negrita);
  y -= altoRec + 14;

  // --- Renglones ---
  const cols = { desc: M + 6, cant: A4.w - M - 210, precio: A4.w - M - 150, sub: A4.w - M - 6 };
  const cabecera = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: M, y: yy - 16, width: A4.w - 2 * M, height: 16, color: rgb(0.93, 0.93, 0.93) });
    t(p, "Producto / Servicio", cols.desc, yy - 11, 8, negrita);
    t(p, "Cant.", cols.cant, yy - 11, 8, negrita);
    t(p, "Precio unit.", cols.precio, yy - 11, 8, negrita);
    const st = "Subtotal";
    t(p, st, cols.sub - negrita.widthOfTextAtSize(st, 8), yy - 11, 8, negrita);
    return yy - 28;
  };
  y = cabecera(page, y);
  for (const r of d.renglones) {
    if (y < 200) {
      page = pdf.addPage([A4.w, A4.h]);
      y = cabecera(page, A4.h - M);
    }
    t(page, recortar(r.description, regular, 8.5, cols.cant - cols.desc - 10), cols.desc, y, 8.5);
    t(page, String(r.qty), cols.cant, y, 8.5);
    t(page, pesos(r.unitPriceMinor), cols.precio, y, 8.5);
    const st = pesos(r.lineTotalMinor);
    t(page, st, cols.sub - regular.widthOfTextAtSize(st, 8.5), y, 8.5);
    y -= 15;
  }

  // --- Total y pie (en la última página) ---
  const yTot = 170;
  page.drawLine({ start: { x: M, y: yTot + 22 }, end: { x: A4.w - M, y: yTot + 22 }, color: LINEA, thickness: 1 });
  const total = `Importe total: ${pesos(d.totalMinor)}`;
  t(page, total, A4.w - M - negrita.widthOfTextAtSize(textoSeguro(total), 12), yTot, 12, negrita);

  page.drawImage(qr, { x: M, y: M, width: 100, height: 100 });
  t(page, "Comprobante autorizado por ARCA", M + 112, M + 78, 9, negrita);
  t(page, `CAE: ${d.cae}`, M + 112, M + 62, 9);
  t(page, `Vencimiento del CAE: ${dia(d.caeVto)}`, M + 112, M + 48, 9);
  t(page, "Escaneá el código para verificar el comprobante en el sitio de ARCA.", M + 112, M + 30, 7.5, regular, GRIS);
  if (d.esPrueba) {
    for (const p of pdf.getPages()) {
      p.drawText("COMPROBANTE DE PRUEBA - SIN VALIDEZ FISCAL", { x: 90, y: 300, size: 26, font: negrita, color: rgb(0.85, 0.2, 0.2), opacity: 0.25, rotate: degrees(35) });
    }
  }
  return pdf.save();
}
