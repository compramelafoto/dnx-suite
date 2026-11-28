import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { formatMoney, maskDni } from "./formato";
import type { ReportItem, ReportSnapshot } from "./snapshot";

/**
 * PDF del informe para aseguradoras. Patrón de `apps/compramelafoto/lib/instructivos/cartel-qr-pdf.ts`.
 * Las fuentes estándar sólo dibujan WinAnsi: todo texto pasa por `toWinAnsi` para que el PDF
 * nunca falle por un carácter raro (emojis, comillas tipográficas fuera del set, etc.).
 */

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 40;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

export { formatMoney, maskDni };

/** Deja sólo lo que la fuente puede dibujar; los saltos y tabs pasan a espacio. */
export function toWinAnsi(text: string, font?: PDFFont): string {
  const normal = text.normalize("NFC").replace(/\s+/g, " ");
  const permitido = font ? new Set(font.getCharacterSet()) : null;
  let out = "";
  for (const ch of normal) {
    const cp = ch.codePointAt(0)!;
    if (permitido ? permitido.has(cp) : cp >= 0x20 && cp <= 0xff && !(cp >= 0x7f && cp < 0xa0)) {
      out += ch;
    } else if (cp === 0x2014 || cp === 0x2013) out += "-";
    else if (cp === 0x201c || cp === 0x201d) out += '"';
    else if (cp === 0x2018 || cp === 0x2019) out += "'";
    // El resto (emojis y símbolos fuera de WinAnsi) se descarta.
  }
  return out;
}

function encoge(texto: string, font: PDFFont, ancho: number, maximo: number, minimo = 6): number {
  let tam = maximo;
  while (tam > minimo && font.widthOfTextAtSize(texto, tam) > ancho) tam -= 0.5;
  return tam;
}

const gris = rgb(0.35, 0.35, 0.35);
const negro = rgb(0.08, 0.08, 0.08);
const linea = rgb(0.8, 0.8, 0.8);

export async function buildInsuranceReportPdf(
  s: ReportSnapshot,
  verifyUrl: string,
  hash?: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Informe de equipamiento fotográfico");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qr = await pdf.embedPng(
    await QRCode.toBuffer(verifyUrl, { type: "png", margin: 1, width: 400 }),
  );

  const t = (x: string, f: PDFFont = regular) => toWinAnsi(x, f);
  const moneda = (n: number) => `$ ${formatMoney(n)}`;
  const dolar = (n: number) => `USD ${formatMoney(n)}`;

  let page: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (
    x: string,
    px: number,
    py: number,
    size: number,
    f: PDFFont = regular,
    color = negro,
  ) => page.drawText(t(x, f), { x: px, y: py, size, font: f, color });

  // Encabezado con el QR a la derecha (primera página).
  const QR = 96;
  page.drawImage(qr, { x: ANCHO - MARGEN - QR, y: ALTO - MARGEN - QR, width: QR, height: QR });
  const urlTam = encoge(t(verifyUrl), regular, QR + 40, 7);
  const qrTexto = t("Escaneá para validar", negrita);
  texto(qrTexto, ANCHO - MARGEN - QR, ALTO - MARGEN - QR - 10, 7.5, negrita);
  page.drawText(t(verifyUrl), {
    x: ANCHO - MARGEN - QR,
    y: ALTO - MARGEN - QR - 20,
    size: urlTam,
    font: regular,
    color: gris,
  });

  texto("Informe de equipamiento fotográfico", MARGEN, y - 18, 18, negrita);
  y -= 40;
  texto(`Emitido el ${fechaAr(new Date(s.issuedAt))}`, MARGEN, y, 10, regular, gris);
  y -= 22;
  texto("Titular", MARGEN, y, 9, regular, gris);
  y -= 14;
  texto(s.holder.legalName, MARGEN, y, 13, negrita);
  y -= 15;
  texto(`DNI ${maskDni(s.holder.documentLast3)}`, MARGEN, y, 10);
  y -= 14;
  texto(
    "Identidad verificada por DNX al momento de emitir el informe. Validá su vigencia con el QR.",
    MARGEN,
    y,
    8,
    regular,
    gris,
  );
  // Debajo del QR hay que dejar libre su altura antes de usar el ancho completo.
  y = Math.min(y - 20, ALTO - MARGEN - QR - 34);

  const nuevaPagina = () => {
    page = pdf.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };

  texto("Equipos declarados", MARGEN, y, 12, negrita);
  y -= 8;
  page.drawLine({
    start: { x: MARGEN, y },
    end: { x: ANCHO - MARGEN, y },
    thickness: 0.7,
    color: linea,
  });
  y -= 16;

  const dibujaItem = (it: ReportItem, n: number) => {
    const titulo = `${n}. ${it.make} ${it.model}`;
    const valores = `${moneda(it.valueArs)}  /  ${dolar(it.valueUsd)}`;
    const anchoValores = negrita.widthOfTextAtSize(t(valores, negrita), 10);
    const tam = encoge(t(titulo, negrita), negrita, ANCHO_UTIL - anchoValores - 12, 11);
    texto(titulo, MARGEN, y, tam, negrita);
    texto(valores, ANCHO - MARGEN - anchoValores, y, 10, negrita);
    y -= 13;
    const kind = KIND_LABELS[it.kind as keyof typeof KIND_LABELS] ?? it.kind;
    const status = STATUS_LABELS[it.status as keyof typeof STATUS_LABELS] ?? it.status;
    texto(
      `${kind} · Serie: ${it.serialRaw ?? "sin número de serie"} · Estado: ${status}`,
      MARGEN + 12,
      y,
      8.5,
      regular,
      gris,
    );
    y -= 11;
    const extra = [
      it.purchaseDate ? `Compra: ${it.purchaseDate.split("-").reverse().join("/")}` : "Compra: sin fecha",
      it.hasPurchaseProof ? "Con comprobante de compra" : "Sin comprobante de compra",
      it.seal
        ? `Sello CompraMeLaFoto: serie vista en ${it.seal.photosCount} ${it.seal.photosCount === 1 ? "foto" : "fotos"} desde ${it.seal.since.split("-").reverse().join("/")}`
        : "Sin sello CompraMeLaFoto",
    ].join(" · ");
    const tamExtra = encoge(t(extra), regular, ANCHO_UTIL - 12, 8.5);
    page.drawText(t(extra), { x: MARGEN + 12, y, size: tamExtra, font: regular, color: gris });
    y -= 10;
    page.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: 0.4,
      color: linea,
    });
    y -= 14;
  };

  const ALTO_ITEM = 52;
  s.items.forEach((it, i) => {
    if (y - ALTO_ITEM < MARGEN + 90) nuevaPagina();
    dibujaItem(it, i + 1);
  });

  if (y - 70 < MARGEN) nuevaPagina();
  y -= 4;
  texto("Total declarado", MARGEN, y, 12, negrita);
  const total = `${moneda(s.totalArs)}  /  ${dolar(s.totalUsd)}`;
  const anchoTotal = negrita.widthOfTextAtSize(t(total, negrita), 12);
  texto(total, ANCHO - MARGEN - anchoTotal, y, 12, negrita);
  y -= 24;
  const pie = [
    "Los valores son declarados por el titular. Este informe refleja el inventario al momento de su emisión.",
    "Para comprobar que no fue alterado y ver si el titular sigue verificado, escaneá el QR o abrí el enlace.",
    hash ? `Huella del contenido (SHA-256): ${hash}` : "",
  ].filter(Boolean);
  for (const l of pie) {
    const tam = encoge(t(l), regular, ANCHO_UTIL, 8, 5);
    page.drawText(t(l), { x: MARGEN, y, size: tam, font: regular, color: gris });
    y -= 11;
  }

  return pdf.save();
}
