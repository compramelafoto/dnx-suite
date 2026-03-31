/**
 * Plantilla serializable: mismo JSON alimenta preview (HTML) y export PDF/PNG.
 * Coordenadas en puntos PDF (1/72"), Y desde el borde superior de la página.
 * El editor visual solo manipula esta estructura; el usuario no ve JSON.
 */

import type { DiplomaFontId } from "./diplomaFonts";
import { normalizeDiplomaFontId } from "./diplomaFonts";

export type { DiplomaFontId };

export type DiplomaTextAlign = "left" | "center" | "right";

export type DiplomaFontStyle = "normal" | "italic";

export type DiplomaTextDecoration = "none" | "underline";

/** Metadatos opcionales de capa (editor); no afectan al merge salvo hidden */
export type DiplomaBlockChrome = {
  locked?: boolean;
  /** Si true, no se dibuja en PDF ni preview de emisión */
  hidden?: boolean;
  /** Nombre amigable en panel de capas */
  layerName?: string;
};

export type DiplomaLayoutTextBlock = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fontSize: number;
  /** Familia tipográfica (preview + PDF); JSON antiguo sin campo → DM Sans al parsear. */
  fontFamily?: DiplomaFontId;
  fontWeight?: "normal" | "bold";
  fontStyle?: DiplomaFontStyle;
  textDecoration?: DiplomaTextDecoration;
  color: string;
  textAlign?: DiplomaTextAlign;
  /**
   * Texto fijo o con placeholders: {{recipientName}}, {{entryTitle}}, {{contestTitle}},
   * {{organizerName}}, {{categoryName}}, {{prizeLabel}}, {{diplomaCode}}, {{issuedDate}}, {{verificationUrl}}
   */
  content: string;
} & DiplomaBlockChrome;

export type DiplomaLayoutQrBlock = {
  id: string;
  type: "qrcode";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
} & DiplomaBlockChrome;

export type DiplomaLayoutImageBlock = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  /** Ruta pública bajo /uploads/... */
  imageUrl: string;
} & DiplomaBlockChrome;

/** Línea horizontal (grosor = height del bloque) */
export type DiplomaLayoutLineBlock = {
  id: string;
  type: "line";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  strokeColor: string;
  strokeWidth: number;
} & DiplomaBlockChrome;

export type DiplomaLayoutRectBlock = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
} & DiplomaBlockChrome;

export type DiplomaLayoutBlock =
  | DiplomaLayoutTextBlock
  | DiplomaLayoutQrBlock
  | DiplomaLayoutImageBlock
  | DiplomaLayoutLineBlock
  | DiplomaLayoutRectBlock;

export type DiplomaLayoutJson = {
  version: number;
  blocks: DiplomaLayoutBlock[];
};

export const DIPLOMA_VARIABLE_KEYS = [
  "recipientName",
  "entryTitle",
  "contestTitle",
  "organizerName",
  "categoryName",
  "prizeLabel",
  "diplomaCode",
  "issuedDate",
  "verificationUrl",
] as const;

export function defaultDiplomaLayoutJson(): DiplomaLayoutJson {
  return {
    version: 2,
    blocks: [
      {
        id: "title",
        type: "text",
        x: 56,
        y: 72,
        width: 730,
        height: 48,
        fontSize: 26,
        fontWeight: "bold",
        color: "#d4af37",
        textAlign: "center",
        content: "{{contestTitle}}",
        layerName: "Título del concurso",
      },
      {
        id: "recipient",
        type: "text",
        x: 56,
        y: 200,
        width: 730,
        height: 40,
        fontSize: 22,
        fontWeight: "bold",
        color: "#fafafa",
        textAlign: "center",
        content: "{{recipientName}}",
        layerName: "Destinatario",
      },
      {
        id: "organizer",
        type: "text",
        x: 56,
        y: 280,
        width: 730,
        height: 28,
        fontSize: 12,
        color: "#a1a1a1",
        textAlign: "center",
        content: "{{organizerName}}",
        layerName: "Organizador",
      },
      {
        id: "category",
        type: "text",
        x: 56,
        y: 320,
        width: 730,
        height: 24,
        fontSize: 11,
        color: "#a1a1a1",
        textAlign: "center",
        content: "{{categoryName}}",
        layerName: "Categoría",
      },
      {
        id: "prize",
        type: "text",
        x: 56,
        y: 352,
        width: 730,
        height: 24,
        fontSize: 11,
        color: "#d4af37",
        textAlign: "center",
        content: "{{prizeLabel}}",
        layerName: "Premio",
      },
      {
        id: "code",
        type: "text",
        x: 56,
        y: 420,
        width: 730,
        height: 20,
        fontSize: 10,
        color: "#666666",
        textAlign: "center",
        content: "Código: {{diplomaCode}} · {{issuedDate}}",
        layerName: "Código y fecha",
      },
      {
        id: "qr",
        type: "qrcode",
        x: 702,
        y: 455,
        width: 96,
        height: 96,
        layerName: "QR verificación",
      },
    ],
  };
}

function readChrome(o: Record<string, unknown>): DiplomaBlockChrome {
  return {
    ...(typeof o.locked === "boolean" ? { locked: o.locked } : {}),
    ...(typeof o.hidden === "boolean" ? { hidden: o.hidden } : {}),
    ...(typeof o.layerName === "string" ? { layerName: o.layerName.slice(0, 120) } : {}),
  };
}

function parseGeometry(o: Record<string, unknown>): { x: number; y: number; width: number; height: number } | null {
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  return { x, y, width, height };
}

export function parseDiplomaLayoutJson(raw: unknown): DiplomaLayoutJson {
  if (!raw || typeof raw !== "object") return defaultDiplomaLayoutJson();
  const v = raw as Record<string, unknown>;
  const blocksRaw = v.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) return defaultDiplomaLayoutJson();
  const blocks: DiplomaLayoutBlock[] = [];
  for (const b of blocksRaw) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : `b-${blocks.length}`;
    const type = o.type;
    const geo = parseGeometry(o);
    if (!geo) continue;
    const chrome = readChrome(o);
    const rot = Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : undefined;
    const op = Number.isFinite(Number(o.opacity)) ? Number(o.opacity) : undefined;

    if (type === "qrcode") {
      blocks.push({
        id,
        type: "qrcode",
        ...geo,
        ...(rot !== undefined ? { rotation: rot } : {}),
        ...(op !== undefined ? { opacity: op } : {}),
        ...chrome,
      });
      continue;
    }
    if (type === "image") {
      const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim() : "";
      if (!imageUrl.startsWith("/")) continue;
      blocks.push({
        id,
        type: "image",
        ...geo,
        imageUrl,
        ...(rot !== undefined ? { rotation: rot } : {}),
        ...(op !== undefined ? { opacity: op } : {}),
        ...chrome,
      });
      continue;
    }
    if (type === "line") {
      const strokeColor =
        typeof o.strokeColor === "string" && o.strokeColor.startsWith("#") ? o.strokeColor : "#d4af37";
      const strokeWidth = Number(o.strokeWidth);
      const sw = Number.isFinite(strokeWidth) && strokeWidth > 0 ? Math.min(strokeWidth, 24) : 2;
      blocks.push({
        id,
        type: "line",
        ...geo,
        strokeColor,
        strokeWidth: sw,
        ...(rot !== undefined ? { rotation: rot } : {}),
        ...(op !== undefined ? { opacity: op } : {}),
        ...chrome,
      });
      continue;
    }
    if (type === "rect") {
      const fillColor =
        typeof o.fillColor === "string" && o.fillColor.startsWith("#") ? o.fillColor : undefined;
      const strokeColor =
        typeof o.strokeColor === "string" && o.strokeColor.startsWith("#") ? o.strokeColor : undefined;
      const strokeWidth = Number(o.strokeWidth);
      const sw =
        strokeColor && Number.isFinite(strokeWidth) && strokeWidth > 0 ? Math.min(strokeWidth, 16) : undefined;
      blocks.push({
        id,
        type: "rect",
        ...geo,
        ...(fillColor ? { fillColor } : {}),
        ...(strokeColor ? { strokeColor } : {}),
        ...(sw !== undefined ? { strokeWidth: sw } : {}),
        ...(rot !== undefined ? { rotation: rot } : {}),
        ...(op !== undefined ? { opacity: op } : {}),
        ...chrome,
      });
      continue;
    }
    if (type === "text") {
      const fontSize = Number(o.fontSize);
      const content = typeof o.content === "string" ? o.content : "";
      if (!Number.isFinite(fontSize) || fontSize < 6) continue;
      const color = typeof o.color === "string" && o.color.startsWith("#") ? o.color : "#fafafa";
      const textAlign =
        o.textAlign === "center" || o.textAlign === "right" || o.textAlign === "left"
          ? o.textAlign
          : "left";
      const fontWeight = o.fontWeight === "bold" ? "bold" : "normal";
      const fontFamily = normalizeDiplomaFontId(o.fontFamily);
      const fontStyle = o.fontStyle === "italic" ? "italic" : "normal";
      const textDecoration = o.textDecoration === "underline" ? "underline" : "none";
      blocks.push({
        id,
        type: "text",
        ...geo,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        textDecoration,
        color,
        textAlign,
        content,
        ...(rot !== undefined ? { rotation: rot } : {}),
        ...(op !== undefined ? { opacity: op } : {}),
        ...chrome,
      });
      continue;
    }
  }
  if (blocks.length === 0) return defaultDiplomaLayoutJson();
  return { version: typeof v.version === "number" ? v.version : 2, blocks };
}

export function newBlockId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
