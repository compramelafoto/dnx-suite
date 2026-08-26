import {
  asObject,
  normalizeBlockConfig,
  type TemplateV2Block,
  type TemplateV2BlockLayout,
  type TemplateV2BlockType,
} from "@/lib/template-v2/render-core";

/**
 * Portapapeles de **solo estilo** (independiente de copiar/pegar bloque completo).
 *
 * Compatibilidad (conservadora):
 * - `text`: solo destinos TEXT o VARIABLE_TEXT (tipografía + color + alineación; no toca contenido ni variableKey).
 * - `image`: solo IMAGE (fit, borderRadius; no toca src/source). La opacidad va en layout (capas).
 * - `shape`: solo SHAPE (relleno, borde, radio). La opacidad va en layout (capas).
 * No hay cruce entre familias (p. ej. texto → imagen): se ignora el pegado.
 */

export type TemplateV2CopiedTextStyle = {
  kind: "text";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  color: string;
  fontItalic: boolean;
  underline: boolean;
  /** Opacidad del bloque (layout), no el contenido. */
  layoutOpacity: number;
};

export type TemplateV2CopiedImageStyle = {
  kind: "image";
  fit: string;
  borderRadius: number;
  layoutOpacity: number;
};

export type TemplateV2CopiedShapeStyle = {
  kind: "shape";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  layoutOpacity: number;
};

export type TemplateV2CopiedBlockStyle =
  | TemplateV2CopiedTextStyle
  | TemplateV2CopiedImageStyle
  | TemplateV2CopiedShapeStyle;

export function extractBlockStyle(block: TemplateV2Block): TemplateV2CopiedBlockStyle | null {
  if (block.type === "TEXT") {
    const n = normalizeBlockConfig("TEXT", block.configJson);
    return {
      kind: "text",
      fontFamily: String(n.fontFamily),
      fontSize: Number(n.fontSize),
      fontWeight: Number(n.fontWeight),
      lineHeight: Number(n.lineHeight),
      letterSpacing: Number(n.letterSpacing),
      textAlign: String(n.textAlign),
      color: String(n.color),
      fontItalic: n.fontItalic === true,
      underline: n.underline === true,
      layoutOpacity: block.layout.opacity ?? 1,
    };
  }
  if (block.type === "VARIABLE_TEXT") {
    const n = normalizeBlockConfig("VARIABLE_TEXT", block.configJson);
    return {
      kind: "text",
      fontFamily: String(n.fontFamily),
      fontSize: Number(n.fontSize),
      fontWeight: Number(n.fontWeight),
      lineHeight: Number(n.lineHeight),
      letterSpacing: Number(n.letterSpacing),
      textAlign: String(n.textAlign),
      color: String(n.color),
      fontItalic: n.fontItalic === true,
      underline: n.underline === true,
      layoutOpacity: block.layout.opacity ?? 1,
    };
  }
  if (block.type === "IMAGE") {
    const n = normalizeBlockConfig("IMAGE", block.configJson);
    return {
      kind: "image",
      fit: String(n.fit),
      borderRadius: Number(n.borderRadius),
      layoutOpacity: block.layout.opacity ?? 1,
    };
  }
  if (block.type === "SHAPE") {
    const n = normalizeBlockConfig("SHAPE", block.configJson);
    return {
      kind: "shape",
      fill: String(n.fill),
      stroke: String(n.stroke),
      strokeWidth: Number(n.strokeWidth),
      radius: Number(n.radius),
      layoutOpacity: block.layout.opacity ?? 1,
    };
  }
  return null;
}

export function canPasteStyle(clip: TemplateV2CopiedBlockStyle | null, targetType: TemplateV2BlockType): boolean {
  if (!clip) return false;
  if (clip.kind === "text") return targetType === "TEXT" || targetType === "VARIABLE_TEXT";
  if (clip.kind === "image") return targetType === "IMAGE";
  if (clip.kind === "shape") return targetType === "SHAPE";
  return false;
}

const TEXT_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "color",
  "fontItalic",
  "underline",
] as const;

function mergeTextStyleIntoConfig(
  cfg: Record<string, unknown>,
  clip: TemplateV2CopiedTextStyle
): Record<string, unknown> {
  const next = { ...cfg };
  for (const k of TEXT_STYLE_KEYS) {
    next[k] = clip[k];
  }
  return next;
}

/**
 * Devuelve el `configJson` completo resultante y un patch opcional de layout (opacidad de capa cuando aplica).
 */
export function buildPasteStyleUpdate(
  clip: TemplateV2CopiedBlockStyle,
  block: TemplateV2Block
): { configJson: Record<string, unknown>; layout?: Partial<TemplateV2BlockLayout> } | null {
  if (!canPasteStyle(clip, block.type)) return null;

  const cfg = asObject(block.configJson);

  if (clip.kind === "text") {
    if (block.type !== "TEXT" && block.type !== "VARIABLE_TEXT") return null;
    return {
      configJson: mergeTextStyleIntoConfig(cfg, clip),
      layout: { opacity: clip.layoutOpacity },
    };
  }

  if (clip.kind === "image") {
    if (block.type !== "IMAGE") return null;
    return {
      configJson: {
        ...cfg,
        fit: clip.fit,
        borderRadius: clip.borderRadius,
      },
      layout: { opacity: clip.layoutOpacity },
    };
  }

  if (clip.kind === "shape") {
    if (block.type !== "SHAPE") return null;
    return {
      configJson: {
        ...cfg,
        fill: clip.fill,
        stroke: clip.stroke,
        strokeWidth: clip.strokeWidth,
        radius: clip.radius,
      },
      layout: { opacity: clip.layoutOpacity },
    };
  }

  return null;
}

/* ---------- Suscripción ligera para React (inspector / pegar habilitado) ---------- */

let clipData: TemplateV2CopiedBlockStyle | null = null;
/** Bloque del que se extrajo el estilo (evita “pegar” sobre la misma capa al hacer clic en la fila). */
let clipSourceBlockId: string | null = null;
let clipVersion = 0;
const listeners = new Set<() => void>();

let cachedSnapshot: {
  v: number;
  data: TemplateV2CopiedBlockStyle | null;
  sourceBlockId: string | null;
} | null = null;

export function getCopiedBlockStyle(): TemplateV2CopiedBlockStyle | null {
  return clipData;
}

export function getCopiedStyleSourceBlockId(): string | null {
  return clipSourceBlockId;
}

export function setCopiedBlockStyle(
  style: TemplateV2CopiedBlockStyle | null,
  sourceBlockId?: string | null
): void {
  clipData = style;
  clipSourceBlockId = style === null ? null : (sourceBlockId ?? null);
  clipVersion += 1;
  cachedSnapshot = null;
  for (const fn of listeners) fn();
}

export function clearCopiedBlockStyle(): void {
  setCopiedBlockStyle(null);
}

export function subscribeCopiedBlockStyle(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getCopiedBlockStyleSnapshot(): {
  v: number;
  data: TemplateV2CopiedBlockStyle | null;
  sourceBlockId: string | null;
} {
  if (!cachedSnapshot || cachedSnapshot.v !== clipVersion) {
    cachedSnapshot = { v: clipVersion, data: clipData, sourceBlockId: clipSourceBlockId };
  }
  return cachedSnapshot;
}
