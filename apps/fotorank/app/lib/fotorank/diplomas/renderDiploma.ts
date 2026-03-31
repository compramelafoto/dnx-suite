import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { pdfToPng } from "pdf-to-png-converter";
import { readDiplomaPdfFontBytes, type DiplomaPdfFontSlot } from "./diplomaFontPdf";
import { normalizeDiplomaFontId, type DiplomaFontId } from "./diplomaFonts";
import type {
  DiplomaLayoutJson,
  DiplomaLayoutTextBlock,
  DiplomaLayoutImageBlock,
  DiplomaLayoutLineBlock,
  DiplomaLayoutRectBlock,
} from "./layoutSchema";
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

type PdfFontSet = { normal: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

function pickPdfFontFace(set: PdfFontSet, block: DiplomaLayoutTextBlock): PDFFont {
  const bold = block.fontWeight === "bold";
  const italic = block.fontStyle === "italic";
  if (bold && italic) return set.boldItalic;
  if (bold) return set.bold;
  if (italic) return set.italic;
  return set.normal;
}

function drawTextBlock(
  page: PDFPage,
  block: DiplomaLayoutTextBlock,
  text: string,
  fonts: PdfFontSet,
  pageHeight: number
): void {
  const size = block.fontSize;
  const face = pickPdfFontFace(fonts, block);
  const maxW = Math.max(40, block.width - 4);
  const lines = wrapLines(text, face, size, maxW);
  const lineHeight = size * 1.2;
  const rgbColor = rgb(hexToRgb01(block.color).r, hexToRgb01(block.color).g, hexToRgb01(block.color).b);
  const underline = block.textDecoration === "underline";

  lines.forEach((line, i) => {
    const lineW = face.widthOfTextAtSize(line, size);
    let x = block.x + 2;
    if (block.textAlign === "center") x = block.x + (block.width - lineW) / 2;
    if (block.textAlign === "right") x = block.x + block.width - lineW - 2;
    const baseline = pageHeight - block.y - (i + 1) * lineHeight;
    if (line) page.drawText(line, { x, y: baseline, size, font: face, color: rgbColor, maxWidth: maxW });
    if (underline && line) {
      const uY = baseline - Math.max(0.8, size * 0.12);
      page.drawLine({
        start: { x, y: uY },
        end: { x: x + lineW, y: uY },
        thickness: Math.max(0.5, size * 0.05),
        color: rgbColor,
      });
    }
  });
}

async function drawImageBlock(
  page: PDFPage,
  block: DiplomaLayoutImageBlock,
  pageHeight: number,
  doc: PDFDocument
): Promise<void> {
  const bytes = await loadOptionalBackgroundBytes(block.imageUrl);
  if (!bytes) return;
  try {
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const yPdf = pageHeight - block.y - block.height;
    page.drawImage(embedded, { x: block.x, y: yPdf, width: block.width, height: block.height });
  } catch {
    /* imagen omitida */
  }
}

function drawLineBlock(page: PDFPage, block: DiplomaLayoutLineBlock, pageHeight: number): void {
  const h = Math.max(block.height, block.strokeWidth);
  const yPdf = pageHeight - block.y - h;
  const c = hexToRgb01(block.strokeColor);
  const col = rgb(c.r, c.g, c.b);
  page.drawRectangle({
    x: block.x,
    y: yPdf,
    width: block.width,
    height: h,
    color: col,
  });
}

function drawRectBlock(page: PDFPage, block: DiplomaLayoutRectBlock, pageHeight: number): void {
  const yPdf = pageHeight - block.y - block.height;
  const fill =
    block.fillColor && block.fillColor.length > 1
      ? rgb(hexToRgb01(block.fillColor).r, hexToRgb01(block.fillColor).g, hexToRgb01(block.fillColor).b)
      : undefined;
  const strokeRgb = block.strokeColor
    ? rgb(
        hexToRgb01(block.strokeColor).r,
        hexToRgb01(block.strokeColor).g,
        hexToRgb01(block.strokeColor).b
      )
    : undefined;
  page.drawRectangle({
    x: block.x,
    y: yPdf,
    width: block.width,
    height: block.height,
    color: fill,
    borderColor: strokeRgb,
    borderWidth: block.strokeColor ? block.strokeWidth ?? 1 : 0,
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
  doc.registerFontkit(fontkit);
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

  const fontHelvetica = await doc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontHelveticaBoldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const diplomaFontCache = new Map<string, PDFFont>();

  const helveticaFallback: PdfFontSet = {
    normal: fontHelvetica,
    bold: fontHelveticaBold,
    italic: fontHelveticaOblique,
    boldItalic: fontHelveticaBoldOblique,
  };

  async function pdfFontsForTextBlock(fid: DiplomaFontId | undefined): Promise<PdfFontSet> {
    const id = normalizeDiplomaFontId(fid);
    const keyN = `${id}-n`;
    const keyB = `${id}-b`;
    const keyI = `${id}-i`;
    const keyBi = `${id}-bi`;
    if (!diplomaFontCache.has(keyN)) {
      try {
        const slots: DiplomaPdfFontSlot[] = ["normal", "bold", "italic", "boldItalic"];
        const keys = [keyN, keyB, keyI, keyBi] as const;
        for (let i = 0; i < 4; i++) {
          const bytes = readDiplomaPdfFontBytes(id, slots[i]!);
          diplomaFontCache.set(keys[i]!, await doc.embedFont(bytes));
        }
      } catch {
        diplomaFontCache.set(keyN, helveticaFallback.normal);
        diplomaFontCache.set(keyB, helveticaFallback.bold);
        diplomaFontCache.set(keyI, helveticaFallback.italic);
        diplomaFontCache.set(keyBi, helveticaFallback.boldItalic);
      }
    }
    return {
      normal: diplomaFontCache.get(keyN)!,
      bold: diplomaFontCache.get(keyB)!,
      italic: diplomaFontCache.get(keyI)!,
      boldItalic: diplomaFontCache.get(keyBi)!,
    };
  }

  const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
    type: "png",
    margin: 1,
    width: 400,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrPngBuffer);

  for (const block of layout.blocks) {
    if (block.hidden) continue;

    if (block.type === "text") {
      const merged = mergeDiplomaTemplate(block.content, variables);
      const fontSet = await pdfFontsForTextBlock(block.fontFamily);
      drawTextBlock(page, block, merged, fontSet, pageHeight);
    } else if (block.type === "qrcode") {
      const s = Math.min(block.width, block.height);
      const yPdf = pageHeight - block.y - s;
      page.drawImage(qrImage, {
        x: block.x,
        y: yPdf,
        width: s,
        height: s,
      });
    } else if (block.type === "image") {
      await drawImageBlock(page, block, pageHeight, doc);
    } else if (block.type === "line") {
      drawLineBlock(page, block, pageHeight);
    } else if (block.type === "rect") {
      drawRectBlock(page, block, pageHeight);
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
