import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { fontDefinition, isGoogleFontId, type FontId, type FontSlot } from "../fonts/catalog";
import { readFontBytes, varianteLeida } from "../fonts/load";
import type { TextMeasurer } from "../layout/plan";

/**
 * Ascendente y descendente de la tipografía, en fracciones del cuerpo (los del navegador), y si
 * la negrita o la cursiva pedidas no existen en la familia y hay que simularlas.
 */
export type MetricasVerticales = {
  ascendente: number;
  descendente: number;
  negritaSimulada: boolean;
  cursivaSimulada: boolean;
};

/** Lo que hace falta de fontkit para ubicar cada letra con su ajuste entre pares (kerning). */
export type FuenteConKerning = {
  unitsPerEm: number;
  layout(texto: string, rasgos?: Record<string, boolean>): {
    glyphs: Array<{ id: number; advanceWidth: number }>;
    positions: Array<{ xAdvance: number }>;
  };
};

/**
 * La fuente de fontkit detrás de una PDFFont incrustada entera (las de Google), o null.
 *
 * pdf-lib no aplica el ajuste entre pares de letras: mide y escribe cada letra con su ancho
 * propio. El navegador sí lo aplica, así que el PDF salía entre 1 y 2 % más ancho que la
 * pantalla, y un nombre largo podía cortarse en otro lugar. Con la fuente de fontkit se ubica
 * cada letra donde la pone la tipografía. Sólo vale para las incrustadas enteras: en las
 * recortadas (`subset`) pdf-lib renumera las letras.
 */
export function fuenteConKerning(font: PDFFont): FuenteConKerning | null {
  const embedder = (font as unknown as { embedder?: { font?: unknown; subset?: unknown } }).embedder;
  if (!embedder || embedder.subset) return null;
  const f = embedder.font as Partial<FuenteConKerning> | undefined;
  return f && typeof f.layout === "function" && typeof f.unitsPerEm === "number"
    ? (f as FuenteConKerning)
    : null;
}

/*
 * Sustituciones apagadas: ligaduras y alternativas de contexto cambian una letra por otra que
 * no tiene código propio, y pdf-lib sólo declara el ancho de las letras con código. Esas otras
 * quedaban con un ancho por defecto de un cuerpo entero y el PDF mostraba huecos ("Cavea t",
 * "Pacifi co"). El ajuste entre pares (kern) queda encendido: es el que define los anchos.
 */
export const RASGOS_TIPOGRAFICOS: Record<string, boolean> = {
  liga: false,
  clig: false,
  dlig: false,
  calt: false,
  rclt: false,
  rlig: false,
  ccmp: false,
  salt: false,
  swsh: false,
};

/** El renglón ya resuelto en letras y posiciones, con los rasgos que el PDF puede escribir. */
export function componerRenglon(fk: FuenteConKerning, texto: string) {
  return fk.layout(texto, RASGOS_TIPOGRAFICOS);
}

/** Ancho de un texto con el ajuste entre pares, igual que en el navegador. */
export function anchoDeTexto(font: PDFFont, texto: string, sizePt: number): number {
  const fk = fuenteConKerning(font);
  if (!fk) return font.widthOfTextAtSize(texto, sizePt);
  const { positions } = componerRenglon(fk, texto);
  let unidades = 0;
  for (const p of positions) unidades += p.xAdvance;
  return (unidades / fk.unitsPerEm) * sizePt;
}

export type PdfFontSet = {
  doc: PDFDocument;
  get(fontId: FontId, slot: FontSlot): PDFFont;
  metricas(fontId: FontId, slot: FontSlot): MetricasVerticales;
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
 * `subset: true` NO es una optimización de tamaño: es lo que hace que los acentos se vean.
 * @fontsource distribuye WOFF, que es un contenedor comprimido. Sin subconjunto, pdf-lib
 * escribe esos bytes tal cual dentro del PDF etiquetados como TrueType, y los lectores los
 * reparan a medias: las letras básicas salen y las acentuadas quedan en cuadraditos. Con
 * subconjunto, fontkit genera un SFNT válido y "código" se imprime como corresponde.
 *
 * La reproducción no sufre: el subconjunto es determinista para los mismos datos, que es
 * exactamente el caso que hay que poder repetir.
 */
export async function createPdfFontSet(
  refs: Array<{ fontId: FontId; slot: FontSlot }>,
): Promise<PdfFontSet> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fuentes = new Map<string, PDFFont>();
  const verticales = new Map<string, MetricasVerticales>();
  const vistos = new Set<string>();
  for (const ref of refs) {
    const k = clave(ref.fontId, ref.slot);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const bytes = await readFontBytes(ref.fontId, ref.slot);
    /*
     * Las medidas verticales se leen del archivo y no de `heightAtSize` de pdf-lib: esa cuenta
     * resta el descendente sin pasarlo a la escala de 1000 unidades, así que en tipografías de
     * 2048 o 2000 unidades (Arimo, Lato, Merriweather, Roboto, Tinos) daba una línea de base
     * varios puntos más arriba que la del navegador.
     */
    const leida = fontkit.create(Buffer.from(bytes)) as unknown as {
      ascent: number;
      descent: number;
      unitsPerEm: number;
    };
    const real = varianteLeida(ref.fontId, ref.slot);
    const pideNegrita = ref.slot === "bold" || ref.slot === "boldItalic";
    const pideCursiva = ref.slot === "italic" || ref.slot === "boldItalic";
    verticales.set(k, {
      ascendente: leida.ascent / leida.unitsPerEm,
      descendente: Math.abs(leida.descent) / leida.unitsPerEm,
      negritaSimulada: pideNegrita && real !== "bold" && real !== "boldItalic",
      cursivaSimulada: pideCursiva && real !== "italic" && real !== "boldItalic",
    });
    /*
     * Las de Google (Fontsource, TrueType del juego latino) se incrustan enteras: son chicas y
     * el subconjunto de fontkit pierde letras en algunas. Las ligaduras y alternativas de
     * contexto van apagadas: pdf-lib las sustituye pero ubica cada letra con el ancho de la
     * original, y Pacifico o Caveat salían con huecos en medio de las palabras ("Cavea t").
     */
    const deGoogle = isGoogleFontId(ref.fontId);
    fuentes.set(
      k,
      await doc.embedFont(bytes, {
        subset: !deGoogle,
        ...(deGoogle ? { features: { liga: false, clig: false, calt: false, dlig: false } } : {}),
      }),
    );
  }

  function get(fontId: FontId, slot: FontSlot): PDFFont {
    const f = fuentes.get(clave(fontId, slot));
    if (!f) {
      throw new Error(
        `La tipografía ${fontDefinition(fontId).label} (${slot}) no fue incrustada. Es un error del propio módulo.`,
      );
    }
    return f;
  }

  function metricas(fontId: FontId, slot: FontSlot): MetricasVerticales {
    return (
      verticales.get(clave(fontId, slot)) ?? {
        ascendente: 0.8,
        descendente: 0.2,
        negritaSimulada: false,
        cursivaSimulada: false,
      }
    );
  }

  return {
    doc,
    get,
    metricas,
    measurer: {
      widthOf: (texto, fontId, slot, sizePt) => anchoDeTexto(get(fontId, slot), texto, sizePt),
    },
  };
}
