import type { DiplomaFontPresetKey } from "../diplomaFonts";
import { DIPLOMA_FONT_PRESETS } from "../diplomaFonts";
import type { DiplomaLayoutBlock, DiplomaLayoutJson } from "../layoutSchema";
import { DIPLOMA_PAGE_H, DIPLOMA_PAGE_W, layout, line, qr, rect, txt } from "./helpers";

export const W = DIPLOMA_PAGE_W;
export const H = DIPLOMA_PAGE_H;

/** Marco doble + marquitas en esquinas (solo rectángulos; compatible PDF). */
export function ornateOuterFrame(
  prefix: string,
  margin: number,
  outer: { stroke: string; w: number },
  inner: { stroke: string; w: number },
  corner: { fill: string; size: number }
): DiplomaLayoutBlock[] {
  const m = margin;
  return [
    rect(`${prefix}-o`, m, m, W - m * 2, H - m * 2, {
      fillColor: "transparent",
      strokeColor: outer.stroke,
      strokeWidth: outer.w,
      layerName: "Marco exterior",
    }),
    rect(`${prefix}-i`, m + 14, m + 14, W - (m + 14) * 2, H - (m + 14) * 2, {
      fillColor: "transparent",
      strokeColor: inner.stroke,
      strokeWidth: inner.w,
      layerName: "Marco interior",
    }),
    rect(`${prefix}-c1`, m + 4, m + 4, corner.size, corner.size, { fillColor: corner.fill, layerName: "Esquina" }),
    rect(`${prefix}-c2`, W - m - 4 - corner.size, m + 4, corner.size, corner.size, {
      fillColor: corner.fill,
      layerName: "Esquina",
    }),
    rect(`${prefix}-c3`, m + 4, H - m - 4 - corner.size, corner.size, corner.size, {
      fillColor: corner.fill,
      layerName: "Esquina",
    }),
    rect(`${prefix}-c4`, W - m - 4 - corner.size, H - m - 4 - corner.size, corner.size, corner.size, {
      fillColor: corner.fill,
      layerName: "Esquina",
    }),
  ];
}

/** Banda superior institucional + filete. */
export function topInstitutionalBand(
  prefix: string,
  height: number,
  fill: string,
  accentLine: string
): DiplomaLayoutBlock[] {
  return [
    rect(`${prefix}-band`, 0, 0, W, height, { fillColor: fill, layerName: "Banda superior" }),
    line(`${prefix}-rule`, 0, height, W, 2, accentLine, 2, "Filete banda"),
  ];
}

/** “Medalla” / placa circular aproximada: anillo dorado + centro. */
export function medalPlaque(
  prefix: string,
  cx: number,
  cy: number,
  outerR: number,
  gold: string,
  inner: string
): DiplomaLayoutBlock[] {
  const d = outerR * 2;
  return [
    rect(`${prefix}-ring`, cx - outerR, cy - outerR, d, d, {
      fillColor: "transparent",
      strokeColor: gold,
      strokeWidth: 4,
      layerName: "Anillo premio",
    }),
    rect(`${prefix}-core`, cx - outerR + 10, cy - outerR + 10, d - 20, d - 20, {
      fillColor: inner,
      strokeColor: gold,
      strokeWidth: 1,
      opacity: 0.95,
      layerName: "Placa central",
    }),
  ];
}

/** Cinta horizontal detrás del título (banda con opacidad). */
export function ribbonBehind(
  prefix: string,
  y: number,
  height: number,
  color: string,
  opacity: number
): DiplomaLayoutBlock[] {
  return [rect(`${prefix}-rib`, 0, y, W, height, { fillColor: color, opacity, layerName: "Cinta" })];
}

/** Franja inferior tipo “sello”. */
export function bottomSealStripe(prefix: string, fill: string, textColor: string): DiplomaLayoutBlock[] {
  return [
    rect(`${prefix}-st`, 0, H - 40, W, 40, { fillColor: fill, opacity: 0.9, layerName: "Sello inferior" }),
    txt(`${prefix}-stx`, 48, H - 30, W - 96, 18, "VERIFICACIÓN DIGITAL · FIRMA DEL CERTIFICADO", {
      fontSize: 7,
      color: textColor,
      textAlign: "center",
      layerName: "Leyenda sello",
    }),
  ];
}

/** Bloques comunes: variables dinámicas + QR (marcos opcionales vía prefijo decor). */
export function stdDynamicStack(
  prefix: string,
  o: {
    titleY: number;
    recipientY: number;
    entryY: number;
    orgY: number;
    catY: number;
    prizeY: number;
    codeY: number;
    qrX: number;
    qrY: number;
    qrS: number;
    titleSize: number;
    recipientSize: number;
    titleColor: string;
    bodyColor: string;
    accentColor: string;
    subtitle?: string;
    /** default fino | simple doble | rich ornamental con esquinas */
    frame?: "default" | "simple" | "rich";
    /** Combinación tipográfica coherente (título / destinatario / cuerpo / premio). */
    fontPreset?: DiplomaFontPresetKey;
  }
): DiplomaLayoutJson {
  const subtitle = o.subtitle ?? "CERTIFICADO DE RECONOCIMIENTO";
  const frameMode = o.frame ?? "default";
  const fonts = DIPLOMA_FONT_PRESETS[o.fontPreset ?? "default"];
  const decor: DiplomaLayoutBlock[] = [];
  if (frameMode === "rich") {
    decor.push(
      ...ornateOuterFrame(
        `${prefix}-orn`,
        26,
        { stroke: o.accentColor, w: 2 },
        { stroke: o.bodyColor, w: 1 },
        { fill: `${o.accentColor}55`, size: 12 }
      )
    );
  } else if (frameMode === "simple") {
    decor.push(
      rect(`${prefix}-frame`, 32, 32, W - 64, H - 64, {
        fillColor: "transparent",
        strokeColor: o.accentColor,
        strokeWidth: 2,
        layerName: "Marco",
      }),
      rect(`${prefix}-frame2`, 46, 46, W - 92, H - 92, {
        fillColor: "transparent",
        strokeColor: o.accentColor,
        strokeWidth: 1,
        opacity: 0.45,
        layerName: "Marco interior",
      })
    );
  } else {
    decor.push(
      rect(`${prefix}-frame`, 32, 32, W - 64, H - 64, {
        fillColor: "transparent",
        strokeColor: o.accentColor,
        strokeWidth: 1,
        layerName: "Marco",
      })
    );
  }

  const blocks = [
    ...decor,
    txt(`${prefix}-subtitle`, 56, o.titleY - 28, W - 112, 22, subtitle, {
      fontSize: 10,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "Subtítulo fijo",
    }),
    txt(`${prefix}-contest`, 56, o.titleY, W - 112, 44, "{{contestTitle}}", {
      fontSize: o.titleSize,
      fontWeight: "bold",
      fontFamily: fonts.title,
      color: o.titleColor,
      textAlign: "center",
      layerName: "Concurso",
    }),
    txt(`${prefix}-recipient`, 56, o.recipientY, W - 112, 52, "{{recipientName}}", {
      fontSize: o.recipientSize,
      fontWeight: "bold",
      fontFamily: fonts.recipient,
      color: o.titleColor,
      textAlign: "center",
      layerName: "Destinatario",
    }),
    txt(`${prefix}-entry`, 56, o.entryY, W - 112, 28, "Obra: {{entryTitle}}", {
      fontSize: 12,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "Obra",
    }),
    txt(`${prefix}-prize`, 56, o.prizeY, W - 112, 26, "{{prizeLabel}}", {
      fontSize: 12,
      fontWeight: "bold",
      fontFamily: fonts.prize,
      color: o.accentColor,
      textAlign: "center",
      layerName: "Premio",
    }),
    txt(`${prefix}-cat`, 56, o.catY, W - 112, 22, "Categoría: {{categoryName}}", {
      fontSize: 11,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "Categoría",
    }),
    txt(`${prefix}-org`, 56, o.orgY, W - 112, 24, "{{organizerName}}", {
      fontSize: 11,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "Organizador",
    }),
    txt(`${prefix}-code`, 56, o.codeY, W - 112, 20, "{{diplomaCode}} · {{issuedDate}}", {
      fontSize: 9,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "Código y fecha",
    }),
    txt(`${prefix}-verify`, 56, o.codeY + 22, W - 112, 16, "{{verificationUrl}}", {
      fontSize: 8,
      fontFamily: fonts.body,
      color: o.bodyColor,
      textAlign: "center",
      layerName: "URL verificación",
    }),
    qr(`${prefix}-qr`, o.qrX, o.qrY, o.qrS),
  ];
  return layout(blocks);
}
