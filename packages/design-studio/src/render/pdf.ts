import { degrees, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { fail, ok, type Result } from "../result";
import type { DesignDocument } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { buildLayoutPlan, type LayoutPage, type LayoutTextItem } from "../layout/plan";
import { isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { createPdfFontSet, type PdfFontSet } from "./fonts-pdf";
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
  // Alto de la mayúscula, sin descendente: fija la primera línea de base bajo el borde
  // superior de la caja.
  const ascenso = font.heightAtSize(item.sizePt, { descender: false });
  const color = hexToRgb(item.color);

  item.lines.forEach((linea, i) => {
    const ancho = font.widthOfTextAtSize(linea, item.sizePt);
    const desplazamiento =
      item.align === "center"
        ? (item.widthPt - ancho) / 2
        : item.align === "right"
          ? item.widthPt - ancho
          : 0;
    const baseY = altoPagina - (item.yPt + ascenso + i * item.lineHeightPt);
    page.drawText(linea, {
      x: item.xPt + desplazamiento,
      y: baseY,
      size: item.sizePt,
      font,
      color,
      opacity: item.opacity,
      ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
    });
  });
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
      page.drawRectangle({
        x: item.xPt,
        y: yPdf,
        width: item.widthPt,
        height: item.heightPt,
        opacity: item.opacity,
        ...(item.fillColor ? { color: hexToRgb(item.fillColor) } : {}),
        ...(item.strokeColor ? { borderColor: hexToRgb(item.strokeColor) } : {}),
        ...(item.strokeWidthPt ? { borderWidth: item.strokeWidthPt } : {}),
        ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
      });
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

    page.drawImage(imagen, {
      x: item.xPt + (item.widthPt - ancho) / 2,
      y: yPdf + (item.heightPt - altoImg) / 2,
      width: ancho,
      height: altoImg,
      opacity: item.opacity,
      ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
    });
  }
}

export async function renderPdf(
  doc: DesignDocument,
  resolved: ResolvedVariables,
  options: RenderPdfOptions,
): Promise<Result<Uint8Array>> {
  const fuentes = await createPdfFontSet(fuentesUsadas(doc));

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
