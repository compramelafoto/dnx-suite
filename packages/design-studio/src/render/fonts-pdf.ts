import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { FONT_CATALOG, type FontId, type FontSlot } from "../fonts/catalog";
import { readFontBytes } from "../fonts/load";
import type { TextMeasurer } from "../layout/plan";

export type PdfFontSet = {
  doc: PDFDocument;
  get(fontId: FontId, slot: FontSlot): PDFFont;
  measurer: TextMeasurer;
};

function clave(fontId: FontId, slot: FontSlot): string {
  return `${fontId}:${slot}`;
}

/**
 * Crea el documento PDF con las fuentes ya incrustadas y un medidor que usa esas mismas
 * fuentes. Medir con una tipografía y dibujar con otra es la forma clásica de que un texto
 * entre en la vista previa y desborde en el archivo final.
 *
 * `subset: false` a propósito: el subconjunto depende de los caracteres presentes, así que
 * dos emisiones con nombres distintos producirían estructuras distintas. Con la fuente
 * entera, el archivo es función de la plantilla y de los datos, que es lo que la
 * reproducción necesita.
 */
export async function createPdfFontSet(
  refs: Array<{ fontId: FontId; slot: FontSlot }>,
): Promise<PdfFontSet> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fuentes = new Map<string, PDFFont>();
  const vistos = new Set<string>();
  for (const ref of refs) {
    const k = clave(ref.fontId, ref.slot);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const bytes = await readFontBytes(ref.fontId, ref.slot);
    fuentes.set(k, await doc.embedFont(bytes, { subset: false }));
  }

  function get(fontId: FontId, slot: FontSlot): PDFFont {
    const f = fuentes.get(clave(fontId, slot));
    if (!f) {
      throw new Error(
        `La tipografía ${FONT_CATALOG[fontId].label} (${slot}) no fue incrustada. Es un error del propio módulo.`,
      );
    }
    return f;
  }

  return {
    doc,
    get,
    measurer: {
      widthOf: (texto, fontId, slot, sizePt) => get(fontId, slot).widthOfTextAtSize(texto, sizePt),
    },
  };
}
