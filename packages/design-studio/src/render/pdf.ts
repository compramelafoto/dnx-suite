import {
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  beginText,
  endText,
  PDFHexString,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  rgb,
  setFillingColor,
  setFontAndSize,
  setGraphicsState,
  setTextMatrix,
  setLineWidth,
  setStrokingColor,
  setTextRenderingMode,
  TextRenderingMode,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { fail, ok, type Result } from "../result";
import type { DesignDocument } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { buildLayoutPlan, type LayoutPage, type LayoutTextItem } from "../layout/plan";
import { isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import {
  anchoDeTexto,
  componerRenglon,
  createPdfFontSet,
  fuenteConKerning,
  type PdfFontSet,
} from "./fonts-pdf";
import { RENDERER_VERSION } from "./version";
import { detectImageFormat, type ResourceResolver } from "./resources";

export type RenderPdfOptions = {
  includeBleed: boolean;
  resources: ResourceResolver;
};

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Fuentes que el documento necesita, para incrustarlas antes de medir. */
function fuentesUsadas(doc: DesignDocument): Array<{ fontId: FontId; slot: FontSlot }> {
  const refs: Array<{ fontId: FontId; slot: FontSlot }> = [];
  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type !== "text" || bloque.hidden) continue;
      // Una tipografía fuera del catálogo NO se intenta cargar acá: buildLayoutPlan la
      // rechaza con un mensaje entendible, y así el error llega como resultado y no como
      // una excepción cruda de lectura de archivo.
      if (!isFontId(bloque.fontId)) continue;
      refs.push({ fontId: bloque.fontId, slot: slotFor(bloque.fontWeight, bloque.fontStyle) });
    }
  }
  return refs;
}

function dibujarTexto(
  page: PDFPage,
  item: LayoutTextItem,
  altoPagina: number,
  fuentes: PdfFontSet,
): void {
  const font = fuentes.get(item.fontId, item.slot);
  /*
   * Cada renglón se ubica como lo hace el navegador: la altura de la letra (ascendente más
   * descendente) va centrada en el interlineado, y la línea de base queda a un ascendente de
   * ese borde. Antes la base iba a un ascendente del borde de la caja, sin repartir el
   * interlineado: el PDF quedaba unos puntos más arriba que la pantalla, y más con
   * interlineados amplios.
   */
  const { ascendente, descendente, negritaSimulada, cursivaSimulada } = fuentes.metricas(
    item.fontId,
    item.slot,
  );
  const ascenso = ascendente * item.sizePt;
  const altoDeLetra = (ascendente + descendente) * item.sizePt;
  const medioInterlineado = (item.lineHeightPt - altoDeLetra) / 2;
  const color = hexToRgb(item.color);

  /*
   * Un texto girado se gira alrededor del centro de su caja, igual que las imágenes y que el
   * lienzo del editor. Antes cada línea llevaba su propio `rotate`, que pdf-lib aplica alrededor
   * del inicio de la línea: a 90° el texto terminaba fuera de su lugar —o fuera de la hoja— y
   * los textos verticales del costado no salían en el PDF.
   */
  const gira = Boolean(item.rotation);
  if (gira) {
    const cx = item.xPt + item.widthPt / 2;
    const cy = altoPagina - (item.yPt + item.heightPt / 2);
    const rad = (-item.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sen = Math.sin(rad);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(1, 0, 0, 1, cx, cy),
      concatTransformationMatrix(cos, sen, -sen, cos, 0, 0),
      concatTransformationMatrix(1, 0, 0, 1, -cx, -cy),
    );
  }

  /*
   * Negrita y cursiva que la familia no trae: el navegador las simula engrosando el contorno y
   * inclinando la letra, y el PDF hace lo mismo. Antes salía la letra normal y el diseño
   * impreso no se parecía al de la pantalla. El grosor es el del motor de Chrome (un treintaidosavo
   * del cuerpo) y la inclinación, un cuarto (unos 14°).
   */
  if (negritaSimulada) {
    page.pushOperators(
      pushGraphicsState(),
      setTextRenderingMode(TextRenderingMode.FillAndOutline),
      setLineWidth(item.sizePt / 32),
      setStrokingColor(color),
    );
  }

  const conKerning = fuenteConKerning(font);
  item.lines.forEach((linea, i) => {
    const ancho = anchoDeTexto(font, linea, item.sizePt);
    const desplazamiento =
      item.align === "center"
        ? (item.widthPt - ancho) / 2
        : item.align === "right"
          ? item.widthPt - ancho
          : 0;
    const baseY = altoPagina - (item.yPt + medioInterlineado + ascenso + i * item.lineHeightPt);
    const x = item.xPt + desplazamiento;
    if (conKerning) {
      escribirConKerning(page, font, conKerning, linea, {
        x,
        y: baseY,
        sizePt: item.sizePt,
        color,
        opacity: item.opacity,
        inclinacion: cursivaSimulada ? 0.25 : 0,
      });
      return;
    }
    page.drawText(linea, {
      x,
      y: baseY,
      size: item.sizePt,
      font,
      color,
      opacity: item.opacity,
      ...(cursivaSimulada ? { xSkew: degrees(14.04) } : {}),
    });
  });

  if (negritaSimulada) page.pushOperators(popGraphicsState());

  if (gira) page.pushOperators(popGraphicsState());
}

async function dibujarPagina(
  page: PDFPage,
  plan: LayoutPage,
  fuentes: PdfFontSet,
  resources: ResourceResolver,
  errores: string[],
): Promise<void> {
  const alto = plan.heightPt;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: plan.widthPt,
    height: alto,
    color: hexToRgb(plan.background),
  });

  for (const item of plan.items) {
    const yPdf = alto - item.yPt - item.heightPt;

    if (item.kind === "rect") {
      // Igual que textos e imágenes: el giro es alrededor del centro de la caja.
      if (item.rotation) {
        const cx = item.xPt + item.widthPt / 2;
        const cy = yPdf + item.heightPt / 2;
        const rad = (-item.rotation * Math.PI) / 180;
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(1, 0, 0, 1, cx, cy),
          concatTransformationMatrix(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0),
          concatTransformationMatrix(1, 0, 0, 1, -cx, -cy),
        );
      }
      /*
       * Como en el lienzo (CSS con `box-sizing: border-box`): el relleno ocupa toda la caja, el
       * borde va por dentro y las esquinas redondeadas se respetan. Antes el borde quedaba
       * centrado sobre el contorno —la mitad afuera— y el radio se ignoraba: las esquinas
       * redondeadas salían rectas en el PDF.
       */
      const w = item.widthPt;
      const h = item.heightPt;
      const radio = Math.min(item.cornerRadiusPt ?? 0, w / 2, h / 2);
      const arriba = alto - item.yPt;
      if (item.fillColor) {
        page.drawSvgPath(trazoRectangulo(0, 0, w, h, radio), {
          x: item.xPt,
          y: arriba,
          color: hexToRgb(item.fillColor),
          opacity: item.opacity,
          borderWidth: 0,
        });
      }
      const trazo = item.strokeColor ? Math.min(item.strokeWidthPt ?? 0, w / 2, h / 2) : 0;
      if (trazo > 0 && item.strokeColor) {
        page.drawSvgPath(
          trazoRectangulo(trazo / 2, trazo / 2, w - trazo, h - trazo, Math.max(0, radio - trazo / 2)),
          {
            x: item.xPt,
            y: arriba,
            borderColor: hexToRgb(item.strokeColor),
            borderWidth: trazo,
            borderOpacity: item.opacity,
          },
        );
      }
      if (item.rotation) page.pushOperators(popGraphicsState());
      continue;
    }

    if (item.kind === "line") {
      page.drawLine({
        start: { x: item.xPt, y: alto - item.yPt },
        end: { x: item.xPt + item.widthPt, y: alto - item.yPt },
        thickness: item.strokeWidthPt,
        color: hexToRgb(item.strokeColor),
        opacity: item.opacity,
      });
      continue;
    }

    if (item.kind === "text") {
      dibujarTexto(page, item, alto, fuentes);
      continue;
    }

    if (item.kind === "qr") {
      const lado = Math.min(item.widthPt, item.heightPt);
      const png = await QRCode.toBuffer(item.payload, {
        type: "png",
        errorCorrectionLevel: item.errorCorrection,
        margin: item.quietZoneModules,
        // Alto suficiente para que el raster no limite la nitidez a 300 puntos por pulgada.
        width: 1024,
        color: { dark: item.darkColor, light: item.lightColor },
      });
      const imagen = await fuentes.doc.embedPng(png);
      page.drawImage(imagen, {
        x: item.xPt,
        y: alto - item.yPt - lado,
        width: lado,
        height: lado,
        opacity: item.opacity,
      });
      continue;
    }

    const bytes = await resources.read(item.ref);
    if (!bytes) {
      errores.push(
        `No se encontró la imagen "${item.ref}" que usa el bloque "${item.id}". No se emite la pieza sin ella.`,
      );
      continue;
    }
    const formato = detectImageFormat(bytes);
    if (!formato) {
      errores.push(`El archivo "${item.ref}" del bloque "${item.id}" no es un PNG ni un JPG.`);
      continue;
    }
    let imagen: PDFImage;
    try {
      imagen =
        formato === "png" ? await fuentes.doc.embedPng(bytes) : await fuentes.doc.embedJpg(bytes);
    } catch (e) {
      errores.push(
        `No se pudo leer la imagen "${item.ref}": ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    // `cover` llena la caja recortando lo que sobra; `contain` entra entera y deja aire.
    const escalaCover = Math.max(item.widthPt / imagen.width, item.heightPt / imagen.height);
    const escalaContain = Math.min(item.widthPt / imagen.width, item.heightPt / imagen.height);
    const escala = item.fit === "cover" ? escalaCover : escalaContain;
    const ancho = imagen.width * escala;
    const altoImg = imagen.height * escala;

    /*
     * El recorte se aplica como región de clip del PDF, no dibujando una forma encima. Tapar
     * con un rectángulo del color del fondo funcionaría solo sobre fondo liso, y dejaría un
     * recuadro visible en cuanto haya una imagen o un degradado detrás.
     *
     * `q … Q` acota el clip a esta imagen: sin el par, todo lo que se dibuje después queda
     * recortado por la misma forma.
     *
     * Se recorta **siempre**, no sólo en las formas redondas. Con `cover` la imagen se agranda
     * hasta cubrir la caja y lo que sobra tiene que quedar afuera: sin recorte se dibujaba
     * entera y se salía por los costados, tapando lo que la rodeaba —un marco, por ejemplo—.
     * Con `contain` la imagen ya entra, así que el recorte no cambia nada.
     */
    const gira = Boolean(item.rotation);
    page.pushOperators(pushGraphicsState());

    /*
     * Cuando el bloque está girado, el recorte tiene que girar con él. Se gira el sistema de
     * coordenadas alrededor del centro de la caja y se dibujan adentro tanto el recorte como la
     * imagen: así los dos quedan alineados. Por eso la imagen ya no lleva su propio `rotate`,
     * que la giraría dos veces.
     */
    if (gira) {
      const cx = item.xPt + item.widthPt / 2;
      const cy = yPdf + item.heightPt / 2;
      const rad = (-item.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sen = Math.sin(rad);
      page.pushOperators(
        concatTransformationMatrix(1, 0, 0, 1, cx, cy),
        concatTransformationMatrix(cos, sen, -sen, cos, 0, 0),
        concatTransformationMatrix(1, 0, 0, 1, -cx, -cy),
      );
    }

    page.pushOperators(...operadoresDeClip(item, yPdf), clip(), endPath());

    page.drawImage(imagen, {
      x: item.xPt + (item.widthPt - ancho) / 2,
      y: yPdf + (item.heightPt - altoImg) / 2,
      width: ancho,
      height: altoImg,
      opacity: item.opacity,
    });

    page.pushOperators(popGraphicsState());
  }
}

/** Proporción para aproximar un cuarto de círculo con una curva de Bézier. */
const K = 0.5522847498;

/**
 * El contorno de la forma con la que se recorta, en coordenadas del PDF.
 *
 * El PDF no tiene primitiva de círculo: se arma con cuatro curvas. Es la misma técnica que usa
 * cualquier motor de dibujo, y `K` es la constante conocida que hace que la curva pase por donde
 * pasaría el círculo.
 */
function operadoresDeClip(
  item: {
    xPt: number;
    widthPt: number;
    heightPt: number;
    mask: "rect" | "circle" | "ellipse";
    cornerRadiusPt?: number;
  },
  yPdf: number,
) {
  const x = item.xPt;
  const y = yPdf;
  const w = item.widthPt;
  const h = item.heightPt;
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (item.mask === "circle" || item.mask === "ellipse") {
    // El círculo se inscribe en el lado corto para no salirse de la caja del bloque.
    const rx = item.mask === "circle" ? Math.min(w, h) / 2 : w / 2;
    const ry = item.mask === "circle" ? Math.min(w, h) / 2 : h / 2;
    const ox = rx * K;
    const oy = ry * K;
    return [
      moveTo(cx - rx, cy),
      appendBezierCurve(cx - rx, cy + oy, cx - ox, cy + ry, cx, cy + ry),
      appendBezierCurve(cx + ox, cy + ry, cx + rx, cy + oy, cx + rx, cy),
      appendBezierCurve(cx + rx, cy - oy, cx + ox, cy - ry, cx, cy - ry),
      appendBezierCurve(cx - ox, cy - ry, cx - rx, cy - oy, cx - rx, cy),
      closePath(),
    ];
  }

  // Rectángulo con esquinas redondeadas. El radio no puede pasar la mitad del lado corto.
  const r = Math.min(item.cornerRadiusPt ?? 0, w / 2, h / 2);
  const o = r * K;
  return [
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + o, y, x + w, y + r - o, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + o, x + w - r + o, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - o, y + h, x, y + h - r + o, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - o, x + r - o, y, x + r, y),
    closePath(),
  ];
}

/** Rectángulo con esquinas redondeadas como trazado SVG (y hacia abajo), para `drawSvgPath`. */
function trazoRectangulo(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return (
    `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/**
 * Escribe un renglón letra por letra con el ajuste entre pares de la tipografía (operador TJ),
 * que es lo que hace el navegador. Ver `fuenteConKerning`.
 */
function escribirConKerning(
  page: PDFPage,
  font: Parameters<PDFPage["setFont"]>[0],
  fk: NonNullable<ReturnType<typeof fuenteConKerning>>,
  linea: string,
  o: { x: number; y: number; sizePt: number; color: ReturnType<typeof rgb>; opacity: number; inclinacion: number },
): void {
  const { glyphs, positions } = componerRenglon(fk, linea);
  const partes: Array<PDFHexString | PDFNumber> = [];
  glyphs.forEach((g, i) => {
    partes.push(PDFHexString.of(g.id.toString(16).padStart(4, "0")));
    const ajuste = ((g.advanceWidth - (positions[i]?.xAdvance ?? g.advanceWidth)) * 1000) / fk.unitsPerEm;
    if (Math.abs(ajuste) > 0.001) partes.push(PDFNumber.of(ajuste));
  });
  const interno = page as unknown as {
    node: { newFontDictionary(name: string, ref: unknown): Parameters<typeof setFontAndSize>[0] };
    doc: { context: { obj(v: unknown[]): never } };
    maybeEmbedGraphicsState(o: { opacity?: number }): string | undefined;
  };
  const clave = interno.node.newFontDictionary(font.name, font.ref);
  const estado = o.opacity < 1 ? interno.maybeEmbedGraphicsState({ opacity: o.opacity }) : undefined;
  page.pushOperators(
    pushGraphicsState(),
    ...(estado ? [setGraphicsState(estado)] : []),
    beginText(),
    setFillingColor(o.color),
    setFontAndSize(clave, o.sizePt),
    setTextMatrix(1, 0, o.inclinacion, 1, o.x, o.y),
    PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [interno.doc.context.obj(partes)]),
    endText(),
    popGraphicsState(),
  );
}

export async function renderPdf(
  doc: DesignDocument,
  resolved: ResolvedVariables,
  options: RenderPdfOptions,
): Promise<Result<Uint8Array>> {
  let fuentes: PdfFontSet;
  try {
    fuentes = await createPdfFontSet(fuentesUsadas(doc));
  } catch (e) {
    // Una tipografía de Google que no se pudo bajar: mejor no emitir que imprimir con otra letra.
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }

  const plan = buildLayoutPlan(doc, resolved, {
    measurer: fuentes.measurer,
    includeBleed: options.includeBleed,
  });
  if (!plan.ok) return plan;

  const errores: string[] = [];
  for (const pagina of plan.value.pages) {
    const page = fuentes.doc.addPage([pagina.widthPt, pagina.heightPt]);
    await dibujarPagina(page, pagina, fuentes, options.resources, errores);
  }
  if (errores.length > 0) return fail(...errores);

  // Fechas fijas: pdf-lib estampa la de creación y la de modificación, y con la hora del
  // reloj dos emisiones idénticas darían archivos distintos. La fecha real de la emisión la
  // guarda el producto, no el archivo.
  const epoch = new Date(0);
  fuentes.doc.setCreationDate(epoch);
  fuentes.doc.setModificationDate(epoch);
  fuentes.doc.setProducer(`DNX Design Studio ${RENDERER_VERSION}`);
  fuentes.doc.setCreator("DNX Design Studio");
  fuentes.doc.setTitle(doc.metadata.name);

  return ok(await fuentes.doc.save({ useObjectStreams: false }));
}
