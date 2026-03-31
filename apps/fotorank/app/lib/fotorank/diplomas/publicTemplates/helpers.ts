import type {
  DiplomaLayoutBlock,
  DiplomaLayoutJson,
  DiplomaLayoutLineBlock,
  DiplomaLayoutRectBlock,
  DiplomaLayoutTextBlock,
} from "../layoutSchema";

export const DIPLOMA_PAGE_W = 842;
export const DIPLOMA_PAGE_H = 595;

export function layout(blocks: DiplomaLayoutBlock[]): DiplomaLayoutJson {
  return { version: 2, blocks };
}

export function txt(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  o: Partial<
    Pick<
      DiplomaLayoutTextBlock,
      | "fontSize"
      | "fontFamily"
      | "color"
      | "fontWeight"
      | "fontStyle"
      | "textDecoration"
      | "textAlign"
      | "layerName"
      | "opacity"
    >
  > = {}
): DiplomaLayoutTextBlock {
  return {
    id,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    content,
    fontSize: o.fontSize ?? 13,
    ...(o.fontFamily ? { fontFamily: o.fontFamily } : {}),
    fontWeight: o.fontWeight ?? "normal",
    ...(o.fontStyle ? { fontStyle: o.fontStyle } : {}),
    ...(o.textDecoration ? { textDecoration: o.textDecoration } : {}),
    color: o.color ?? "#fafafa",
    textAlign: o.textAlign ?? "center",
    ...(o.layerName ? { layerName: o.layerName } : {}),
    ...(o.opacity != null ? { opacity: o.opacity } : {}),
  };
}

export function qr(id: string, x: number, y: number, size: number, layerName = "QR verificación"): DiplomaLayoutBlock {
  return { id, type: "qrcode", x, y, width: size, height: size, layerName };
}

export function line(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  strokeColor: string,
  strokeWidth: number,
  layerName?: string
): DiplomaLayoutLineBlock {
  return {
    id,
    type: "line",
    x,
    y,
    width: w,
    height: h,
    strokeColor,
    strokeWidth,
    ...(layerName ? { layerName } : {}),
  };
}

export function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  o: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    layerName?: string;
    opacity?: number;
  } = {}
): DiplomaLayoutRectBlock {
  return {
    id,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    fillColor: o.fillColor,
    strokeColor: o.strokeColor,
    strokeWidth: o.strokeWidth,
    ...(o.layerName ? { layerName: o.layerName } : {}),
    ...(o.opacity != null ? { opacity: o.opacity } : {}),
  };
}
