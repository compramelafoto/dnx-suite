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
    // `subset: true` no es por tamaño: si los bytes llegaran en WOFF —que es lo que
    // distribuye @fontsource— sin subconjunto pdf-lib los escribe tal cual dentro del PDF
    // etiquetados como TrueType, y las letras acentuadas salen en cuadraditos. Todavía
    // nadie pasa fuentes propias por acá; queda resuelto de antemano.
    const regular = await pdfDoc.embedFont(options.customRegularBytes, { subset: true });
    const bold = await pdfDoc.embedFont(options.customBoldBytes, { subset: true });
    const semibold = options.customSemiboldBytes
      ? await pdfDoc.embedFont(options.customSemiboldBytes, { subset: true })
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
