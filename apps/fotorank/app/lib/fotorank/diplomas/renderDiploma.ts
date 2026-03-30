import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { pdfToPng } from "pdf-to-png-converter";
import type { DiplomaLayoutJson, DiplomaLayoutTextBlock } from "./layoutSchema";
import { mergeDiplomaTemplate, type DiplomaMergeVariables } from "./mergeFields";

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    if ([r, g, b].every((n) => !Number.isNaN(n))) return { r, g, b };
  }
  return { r: 1, g: 1, b: 1 };
}

async function loadOptionalBackgroundBytes(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url?.trim()) return null;
  const u = url.trim();
  try {
    if (u.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", u.replace(/^\//, ""));
      const buf = await fs.readFile(filePath);
      return new Uint8Array(buf);
    }
    if (u.startsWith("http://") || u.startsWith("https://")) {
      const res = await fetch(u);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return new Uint8Array(ab);
    }
  } catch {
    return null;
  }
  return null;
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    const width = font.widthOfTextAtSize(trial, fontSize);
    if (width <= maxWidth || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTextBlock(
  page: PDFPage,
  block: DiplomaLayoutTextBlock,
  text: string,
  font: PDFFont,
  fontBold: PDFFont,
  pageHeight: number
): void {
  const size = block.fontSize;
  const face = block.fontWeight === "bold" ? fontBold : font;
  const maxW = Math.max(40, block.width - 4);
  const lines = wrapLines(text, face, size, maxW);
  const lineHeight = size * 1.2;
  const rgbColor = rgb(hexToRgb01(block.color).r, hexToRgb01(block.color).g, hexToRgb01(block.color).b);

  lines.forEach((line, i) => {
    const lineW = face.widthOfTextAtSize(line, size);
    let x = block.x + 2;
    if (block.textAlign === "center") x = block.x + (block.width - lineW) / 2;
    if (block.textAlign === "right") x = block.x + block.width - lineW - 2;
    const baseline = pageHeight - block.y - (i + 1) * lineHeight;
    if (line) page.drawText(line, { x, y: baseline, size, font: face, color: rgbColor, maxWidth: maxW });
  });
}

export type RenderDiplomaInput = {
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImageUrl?: string | null;
  layout: DiplomaLayoutJson;
  variables: DiplomaMergeVariables;
  /** Valor embebido en el QR (típicamente verificationUrl). */
  qrPayload: string;
};

export async function renderDiplomaPdf(input: RenderDiplomaInput): Promise<Buffer> {
  const { widthPt, heightPt, backgroundColor, backgroundImageUrl, layout, variables, qrPayload } = input;
  const doc = await PDFDocument.create();
  const page = doc.addPage([widthPt, heightPt]);
  const pageHeight = heightPt;

  const bg = hexToRgb01(backgroundColor);
  page.drawRectangle({ x: 0, y: 0, width: widthPt, height: heightPt, color: rgb(bg.r, bg.g, bg.b) });

  const bgBytes = await loadOptionalBackgroundBytes(backgroundImageUrl ?? null);
  if (bgBytes) {
    try {
      const isPng =
        bgBytes.length >= 8 &&
        bgBytes[0] === 0x89 &&
        bgBytes[1] === 0x50 &&
        bgBytes[2] === 0x4e &&
        bgBytes[3] === 0x47;
      const embedded = isPng ? await doc.embedPng(bgBytes) : await doc.embedJpg(bgBytes);
      page.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
    } catch {
      // fondo omitido si el binario no es imagen válida
    }
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
    type: "png",
    margin: 1,
    width: 400,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrPngBuffer);

  for (const block of layout.blocks) {
    if (block.type === "text") {
      const merged = mergeDiplomaTemplate(block.content, variables);
      drawTextBlock(page, block, merged, font, fontBold, pageHeight);
    } else if (block.type === "qrcode") {
      const yPdf = pageHeight - block.y - block.height;
      page.drawImage(qrImage, {
        x: block.x,
        y: yPdf,
        width: block.width,
        height: block.height,
      });
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function pdfBufferToPngBuffer(pdf: Buffer): Promise<Buffer> {
  const pdfAb = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
  const out = await pdfToPng(pdfAb, {
    pagesToProcess: [1],
    returnPageContent: true,
    viewportScale: 2,
  });
  const first = out[0];
  if (!first?.content) throw new Error("No se pudo rasterizar el PDF a PNG.");
  return Buffer.from(first.content);
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
