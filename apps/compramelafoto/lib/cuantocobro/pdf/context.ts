import { PDFDocument } from "pdf-lib";
import { buildPdfDocumentColors } from "./colors";
import { embedPdfStandardFonts, type EmbedPdfFontsOptions } from "./fonts";
import type { PdfDocumentContext, PdfPageSize } from "./types";
import { PDF_A4_PORTRAIT } from "./types";

export type CreatePdfDocumentContextOptions = {
  pageSize?: PdfPageSize;
  margin?: number;
  accentColorHex?: string | null;
  metadata?: Record<string, string>;
  defaultLineHeight?: number;
  fontOptions?: EmbedPdfFontsOptions;
};

export async function createPdfDocumentContext(
  options: CreatePdfDocumentContextOptions = {},
): Promise<PdfDocumentContext> {
  const pageSize = options.pageSize ?? PDF_A4_PORTRAIT;
  const [width, height] = pageSize;
  const margin = options.margin ?? 48;
  const colorTokens = buildPdfDocumentColors(options.accentColorHex);

  const pdfDoc = await PDFDocument.create();
  const fonts = await embedPdfStandardFonts(pdfDoc, options.fontOptions);
  const page = pdfDoc.addPage(pageSize);

  return {
    pdfDoc,
    page,
    width,
    height,
    margin,
    contentWidth: width - margin * 2,
    cursorY: height - margin,
    fonts,
    colors: {
      textPrimary: colorTokens.textPrimary,
      textSecondary: colorTokens.textSecondary,
      textMuted: colorTokens.textMuted,
      border: colorTokens.border,
      softBackground: colorTokens.softBackground,
      accent: colorTokens.accent,
      success: colorTokens.success,
    },
    accentColorHex: colorTokens.accentColorHex,
    metadata: { ...options.metadata },
    pageNumber: 1,
    totalPages: 1,
    defaultLineHeight: options.defaultLineHeight ?? 14,
  };
}

/** Sincroniza `totalPages` con el documento antes de guardar. */
export function finalizePdfPages(ctx: PdfDocumentContext): void {
  ctx.totalPages = ctx.pdfDoc.getPageCount();
}

export async function savePdfDocument(ctx: PdfDocumentContext): Promise<Uint8Array> {
  finalizePdfPages(ctx);
  return ctx.pdfDoc.save();
}
