import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PdfDocumentFonts } from "./types";

export type EmbedPdfFontsOptions = {
  /** Reservado para Sprint futuro: bytes TTF/OTF custom. */
  customRegularBytes?: Uint8Array;
  customBoldBytes?: Uint8Array;
  customSemiboldBytes?: Uint8Array;
};

/** Embebe fuentes estándar Helvetica; deja hook para custom fonts. */
export async function embedPdfStandardFonts(
  pdfDoc: PDFDocument,
  options: EmbedPdfFontsOptions = {},
): Promise<PdfDocumentFonts> {
  if (options.customRegularBytes && options.customBoldBytes) {
    const regular = await pdfDoc.embedFont(options.customRegularBytes);
    const bold = await pdfDoc.embedFont(options.customBoldBytes);
    const semibold = options.customSemiboldBytes
      ? await pdfDoc.embedFont(options.customSemiboldBytes)
      : bold;
    return { regular, bold, semibold };
  }

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  return {
    regular,
    bold,
    semibold: bold,
  };
}
