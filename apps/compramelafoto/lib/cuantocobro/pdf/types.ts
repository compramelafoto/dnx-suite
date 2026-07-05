import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";

export type PdfPageSize = [width: number, height: number];

export const PDF_A4_PORTRAIT: PdfPageSize = [595, 842];

export type PdfDocumentFonts = {
  regular: PDFFont;
  bold: PDFFont;
  /** Hoy igual a bold; reservado para fuente custom semibold. */
  semibold: PDFFont;
};

export type PdfDocumentColors = {
  textPrimary: RGB;
  textSecondary: RGB;
  textMuted: RGB;
  border: RGB;
  softBackground: RGB;
  accent: RGB;
  success: RGB;
};

export type PdfDocumentContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  margin: number;
  contentWidth: number;
  cursorY: number;
  fonts: PdfDocumentFonts;
  colors: PdfDocumentColors;
  /** Hex original del acento (p. ej. perfil comercial). */
  accentColorHex: string;
  metadata: Record<string, string>;
  pageNumber: number;
  /** Se actualiza al cerrar el documento si se llama `finalizePdfPages`. */
  totalPages: number;
  defaultLineHeight: number;
};

export type PdfTextAlign = "left" | "center" | "right";

export type PdfDrawTextOptions = {
  size?: number;
  bold?: boolean;
  semibold?: boolean;
  color?: RGB;
  align?: PdfTextAlign;
  lineHeight?: number;
};

export type PdfDrawWrappedTextOptions = PdfDrawTextOptions & {
  maxWidth?: number;
};

export type PdfLogoEmbedResult =
  | { kind: "image"; image: PDFImage; width: number; height: number }
  | { kind: "fallback"; label: string };
