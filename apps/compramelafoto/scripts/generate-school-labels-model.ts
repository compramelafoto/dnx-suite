import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";

const A4_W = 595.28;
const A4_H = 841.89;
const COLS = 2;
const ROWS = 3;
const CELL_W = A4_W / COLS;
const CELL_H = A4_H / ROWS;

const PAD = 14;
const QR_MARGIN_BOTTOM = 12;
const BORDER_COLOR = rgb(0.82, 0.82, 0.82);
const REF_COLOR = rgb(0.42, 0.42, 0.42);
const GUIDE_COLOR = rgb(0.88, 0.88, 0.88);

function fitWidth(text: string, maxW: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  const ell = "…";
  while (s.length > 0 && font.widthOfTextAtSize(s + ell, size) > maxW) {
    s = s.slice(0, -1);
  }
  return s ? s + ell : ell;
}

async function loadOptionalLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  const candidates = [
    path.join(process.cwd(), "public", "logo-estudio.png"),
    path.join(process.cwd(), "public", "logo.png"),
    path.join(process.cwd(), "public", "brand", "logo.png"),
  ];
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      return await pdfDoc.embedPng(bytes);
    } catch {
      // Probar siguiente candidato.
    }
  }
  return null;
}

function drawPageCutGuides(page: PDFPage) {
  for (let c = 1; c < COLS; c++) {
    const x = c * CELL_W;
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: A4_H },
      thickness: 0.35,
      color: GUIDE_COLOR,
    });
  }
  for (let r = 1; r < ROWS; r++) {
    const y = A4_H - r * CELL_H;
    page.drawLine({
      start: { x: 0, y },
      end: { x: A4_W, y },
      thickness: 0.35,
      color: GUIDE_COLOR,
    });
  }
}

function drawLabelInCell(
  page: PDFPage,
  x0: number,
  y0: number,
  cellW: number,
  cellH: number,
  opts: {
    alumno: string;
    cliente: string;
    curso: string;
    escuela: string;
    refLine: string;
    qrImage: PDFImage;
    logoImage: PDFImage | null;
    font: PDFFont;
    fontBold: PDFFont;
  }
) {
  const { alumno, cliente, curso, escuela, refLine, qrImage, logoImage, font, fontBold } = opts;
  const cellTop = y0 + cellH;
  const innerX = x0 + PAD;
  const innerY = y0 + PAD;
  const innerW = cellW - PAD * 2;
  const innerTop = cellTop - PAD;

  page.drawRectangle({
    x: x0 + 0.7,
    y: y0 + 0.7,
    width: cellW - 1.4,
    height: cellH - 1.4,
    borderWidth: 0.7,
    borderColor: BORDER_COLOR,
  });

  const headerH = 18;
  const qrSize = Math.min(84, Math.floor(innerW * 0.44));
  const qrX = x0 + (cellW - qrSize) / 2;
  const qrY = innerY + QR_MARGIN_BOTTOM;
  const refY = qrY + qrSize + 8;
  const textTopY = innerTop - headerH - 6;
  const textBottomY = refY + 16;
  const span = Math.max(52, textTopY - textBottomY);

  if (logoImage) {
    const desiredH = 11;
    const ratio = logoImage.width / logoImage.height;
    const logoW = Math.min(innerW * 0.35, desiredH * ratio);
    page.drawImage(logoImage, {
      x: innerX,
      y: innerTop - desiredH,
      width: logoW,
      height: desiredH,
    });
  }

  const headerText = "Entrega escolar";
  const headerSize = 8;
  const headerW = font.widthOfTextAtSize(headerText, headerSize);
  page.drawText(headerText, {
    x: innerX + innerW - headerW,
    y: innerTop - 11,
    size: headerSize,
    font,
    color: REF_COLOR,
  });

  const alumnoY = textTopY;
  const clienteY = textTopY - span * 0.32;
  const cursoY = textTopY - span * 0.6;
  const escuelaY = textTopY - span * 0.8;

  const drawCentered = (rawText: string, y: number, size: number, usedFont: PDFFont, color?: ReturnType<typeof rgb>) => {
    const text = fitWidth(rawText, innerW, usedFont, size);
    const w = usedFont.widthOfTextAtSize(text, size);
    const x = x0 + (cellW - w) / 2;
    page.drawText(text, { x, y, size, font: usedFont, color });
  };

  drawCentered(alumno, alumnoY, 14, fontBold);
  drawCentered(`Cliente: ${cliente}`, clienteY, 10, font);
  drawCentered(`Curso: ${curso}`, cursoY, 9, font);
  drawCentered(`Escuela: ${escuela}`, escuelaY, 9, font);
  drawCentered(`Ref: ${refLine}`, refY, 8, font, REF_COLOR);

  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
}

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await loadOptionalLogo(pdfDoc);
  const page = pdfDoc.addPage([A4_W, A4_H]);
  drawPageCutGuides(page);

  const alumno = "Valentina Perez";
  const cliente = "Carla Gomez";
  const curso = "5to B";
  const escuela = "Colegio Modelo San Martin";

  for (let i = 0; i < 6; i++) {
    const slot = i % 6;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x0 = col * CELL_W;
    const y0 = A4_H - (row + 1) * CELL_H;

    const token = `modelo-${String(i + 1).padStart(2, "0")}-ABCDEF1234`;
    const qrUrl = `https://example.com/escolar/entrega/${encodeURIComponent(token)}`;
    const pngBuffer = await QRCode.toBuffer(qrUrl, { type: "png", width: 240, margin: 1 });
    const qrImage = await pdfDoc.embedPng(pngBuffer);

    drawLabelInCell(page, x0, y0, CELL_W, CELL_H, {
      alumno,
      cliente,
      curso,
      escuela,
      refLine: `MO${String(i + 1).padStart(2, "0")}…1234`,
      qrImage,
      logoImage,
      font,
      fontBold,
    });
  }

  const outputDir = path.join(process.cwd(), "scripts", "output");
  const outputPath = path.join(outputDir, "etiquetas-escolar-modelo.pdf");
  await mkdir(outputDir, { recursive: true });
  const bytes = await pdfDoc.save();
  await writeFile(outputPath, Buffer.from(bytes));

  console.log(`PDF generado en: ${outputPath}`);
}

main().catch((error) => {
  console.error("Error generando PDF de modelo:", error);
  process.exit(1);
});
