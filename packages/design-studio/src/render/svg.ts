import QRCode from "qrcode";
import { ok, type Result } from "../result";
import type { DesignDocument } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { buildLayoutPlan, type LayoutPage } from "../layout/plan";
import { FONT_CATALOG, isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { createPdfFontSet } from "./fonts-pdf";

export function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** La forma con la que se recorta una imagen, como `clipPath` propio del bloque. */
function clipDeImagen(item: {
  id: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  mask: "rect" | "circle" | "ellipse";
  cornerRadiusPt?: number;
}): { def: string; attr: string } {
  const cx = item.xPt + item.widthPt / 2;
  const cy = item.yPt + item.heightPt / 2;

  let forma = "";
  if (item.mask === "circle") {
    // Círculo perfecto: el radio lo manda el lado corto, así no se sale de la caja.
    const r = Math.min(item.widthPt, item.heightPt) / 2;
    forma = `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  } else if (item.mask === "ellipse") {
    forma = `<ellipse cx="${cx}" cy="${cy}" rx="${item.widthPt / 2}" ry="${item.heightPt / 2}"/>`;
  } else if (item.cornerRadiusPt) {
    forma = `<rect x="${item.xPt}" y="${item.yPt}" width="${item.widthPt}" height="${item.heightPt}" rx="${item.cornerRadiusPt}"/>`;
  }
  if (!forma) return { def: "", attr: "" };

  const id = `clip-${item.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return {
    def: `<clipPath id="${id}">${forma}</clipPath>`,
    attr: ` clip-path="url(#${id})"`,
  };
}

function svgDePagina(pagina: LayoutPage, qrPorItem: Map<string, string>): string {
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pagina.widthPt}" height="${pagina.heightPt}" viewBox="0 0 ${pagina.widthPt} ${pagina.heightPt}">`,
    `<rect x="0" y="0" width="${pagina.widthPt}" height="${pagina.heightPt}" fill="${pagina.background}"/>`,
  ];

  for (const item of pagina.items) {
    const giro = item.rotation
      ? ` transform="rotate(${item.rotation} ${item.xPt + item.widthPt / 2} ${item.yPt + item.heightPt / 2})"`
      : "";
    const alfa = item.opacity !== 1 ? ` opacity="${item.opacity}"` : "";

    if (item.kind === "rect") {
      const radio = item.cornerRadiusPt ? ` rx="${item.cornerRadiusPt}"` : "";
      partes.push(
        `<rect x="${item.xPt}" y="${item.yPt}" width="${item.widthPt}" height="${item.heightPt}"${radio}` +
          ` fill="${item.fillColor ?? "none"}"` +
          (item.strokeColor
            ? ` stroke="${item.strokeColor}" stroke-width="${item.strokeWidthPt ?? 1}"`
            : "") +
          `${alfa}${giro}/>`,
      );
      continue;
    }

    if (item.kind === "line") {
      partes.push(
        `<line x1="${item.xPt}" y1="${item.yPt}" x2="${item.xPt + item.widthPt}" y2="${item.yPt}"` +
          ` stroke="${item.strokeColor}" stroke-width="${item.strokeWidthPt}"${alfa}${giro}/>`,
      );
      continue;
    }

    if (item.kind === "text") {
      const def = FONT_CATALOG[item.fontId];
      const anclaje = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
      const x =
        item.align === "center"
          ? item.xPt + item.widthPt / 2
          : item.align === "right"
            ? item.xPt + item.widthPt
            : item.xPt;
      const peso = item.slot === "bold" || item.slot === "boldItalic" ? "700" : "400";
      const estilo = item.slot === "italic" || item.slot === "boldItalic" ? "italic" : "normal";
      partes.push(`<g${alfa}${giro}>`);
      item.lines.forEach((linea, i) => {
        // Sin descendente, la primera línea de base queda a un cuerpo del borde superior.
        const y = item.yPt + item.sizePt + i * item.lineHeightPt;
        partes.push(
          `<text x="${x}" y="${y}" text-anchor="${anclaje}" fill="${item.color}"` +
            ` font-family="${escapeXml(def.fallbackStack)}" font-size="${item.sizePt}"` +
            ` font-weight="${peso}" font-style="${estilo}">${escapeXml(linea)}</text>`,
        );
      });
      partes.push(`</g>`);
      continue;
    }

    if (item.kind === "qr") {
      const lado = Math.min(item.widthPt, item.heightPt);
      const dataUri = qrPorItem.get(item.id) ?? "";
      partes.push(
        `<image x="${item.xPt}" y="${item.yPt}" width="${lado}" height="${lado}" href="${dataUri}"${alfa}${giro}/>`,
      );
      continue;
    }

    // La imagen se referencia por su clave: quien muestre el SVG la resuelve a una URL
    // firmada. El módulo no sabe dónde vive el archivo.
    /*
     * El recorte se hace con una máscara y no dibujando una forma encima: una foto circular
     * dentro de un carnet tiene que dejar ver el fondo alrededor, no taparlo con un cuadrado
     * del color que se haya adivinado.
     */
    const recorte = clipDeImagen(item);
    partes.push(
      recorte.def +
        `<image x="${item.xPt}" y="${item.yPt}" width="${item.widthPt}" height="${item.heightPt}"` +
        ` data-resource-ref="${escapeXml(item.ref)}" preserveAspectRatio="${item.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}"${recorte.attr}${alfa}${giro}/>`,
    );
  }

  partes.push("</svg>");
  return partes.join("");
}

/**
 * Un SVG por cara, para la vista en vivo. Usa el mismo medidor que el PDF, así que el corte
 * de líneas es idéntico al del archivo que se imprime.
 */
export async function renderSvgPages(
  doc: DesignDocument,
  resolved: ResolvedVariables,
): Promise<Result<string[]>> {
  const refs: Array<{ fontId: FontId; slot: FontSlot }> = [];
  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type !== "text" || bloque.hidden) continue;
      if (!isFontId(bloque.fontId)) continue;
      refs.push({ fontId: bloque.fontId, slot: slotFor(bloque.fontWeight, bloque.fontStyle) });
    }
  }
  const fuentes = await createPdfFontSet(refs);

  const plan = buildLayoutPlan(doc, resolved, { measurer: fuentes.measurer, includeBleed: false });
  if (!plan.ok) return plan;

  const svgs: string[] = [];
  for (const pagina of plan.value.pages) {
    const qrPorItem = new Map<string, string>();
    for (const item of pagina.items) {
      if (item.kind !== "qr") continue;
      const dataUri = await QRCode.toDataURL(item.payload, {
        errorCorrectionLevel: item.errorCorrection,
        margin: item.quietZoneModules,
        width: 512,
        color: { dark: item.darkColor, light: item.lightColor },
      });
      qrPorItem.set(item.id, dataUri);
    }
    svgs.push(svgDePagina(pagina, qrPorItem));
  }
  return ok(svgs);
}
