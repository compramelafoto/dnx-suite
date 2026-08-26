import type { TemplateV2Block, TemplateV2Canvas } from "@/lib/template-v2/render-core";

function newBlockId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `blk-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

function nextZIndex(blocks: TemplateV2Block[]): number {
  if (blocks.length === 0) return 1;
  return blocks.reduce((max, b) => Math.max(max, b.layout.zIndex), 0) + 1;
}

/** Pequeño desfase para que varios inserts no queden exactamente superpuestos */
function staggerOffset(blockCount: number): { dx: number; dy: number } {
  const step = 28;
  const n = blockCount % 8;
  return { dx: n * step, dy: n * step };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Una línea de texto + pequeño margen vertical; evita un recuadro mucho más alto que el texto. */
function textBoxHeightForLine(fontSize: number, lineHeight: number): number {
  const lh = typeof lineHeight === "number" && Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.2;
  const oneLinePx = lh <= 6 ? Math.ceil(fontSize * lh) : Math.ceil(lh);
  return Math.max(28, oneLinePx + 8);
}

function placeBlock(args: {
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  width: number;
  height: number;
}): { x: number; y: number; zIndex: number } {
  const { dx, dy } = staggerOffset(args.blocks.length);
  const w = args.width;
  const h = args.height;
  const cx = args.canvas.width / 2 - w / 2 + dx;
  const cy = args.canvas.height / 2 - h / 2 + dy;
  return {
    x: clamp(cx, 12, Math.max(12, args.canvas.width - w - 12)),
    y: clamp(cy, 12, Math.max(12, args.canvas.height - h - 12)),
    zIndex: nextZIndex(args.blocks),
  };
}

export function createDefaultTextBlock(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex = 0
): TemplateV2Block {
  const w = Math.min(720, Math.max(120, canvas.width - 48));
  const lineHeight = 1.15;
  const fontSize = 42;
  const h = textBoxHeightForLine(fontSize, lineHeight);
  const { x, y, zIndex } = placeBlock({ canvas, blocks, width: w, height: h });
  return {
    id: newBlockId(),
    type: "TEXT",
    pageIndex,
    name: "Texto",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      content: "Nuevo texto",
      fontFamily: "Helvetica",
      fontSize,
      fontWeight: 600,
      lineHeight,
      letterSpacing: 0,
      textAlign: "CENTER",
      color: "#111827",
    },
  };
}

/**
 * Texto tipo “punto” (clic simple con herramienta texto): inserción en coordenadas, caja estrecha que crece al tipear.
 */
export function createPointTextBlockAt(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex: number,
  x: number,
  y: number
): TemplateV2Block {
  const lineHeight = 1.15;
  const fontSize = 42;
  const h = textBoxHeightForLine(fontSize, lineHeight);
  const w = 72;
  const clampedX = clamp(x, 8, Math.max(8, canvas.width - w - 8));
  const clampedY = clamp(y, 8, Math.max(8, canvas.height - h - 8));
  return {
    id: newBlockId(),
    type: "TEXT",
    pageIndex,
    name: "Texto",
    layout: {
      x: clampedX,
      y: clampedY,
      width: w,
      height: h,
      rotation: 0,
      zIndex: nextZIndex(blocks),
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      content: "",
      fontFamily: "Helvetica",
      fontSize,
      fontWeight: 600,
      lineHeight,
      letterSpacing: 0,
      textAlign: "LEFT",
      color: "#111827",
    },
  };
}

/** Texto en área delimitada (clic + arrastre con herramienta texto). */
export function createAreaTextBlockInRect(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex: number,
  left: number,
  top: number,
  width: number,
  height: number
): TemplateV2Block {
  const lineHeight = 1.15;
  const fontSize = 36;
  const MIN = 24;
  let x = clamp(left, 0, Math.max(0, canvas.width - MIN));
  let y = clamp(top, 0, Math.max(0, canvas.height - MIN));
  let w = Math.max(MIN, width);
  let h = Math.max(MIN, height);
  if (x + w > canvas.width) w = Math.max(MIN, canvas.width - x);
  if (y + h > canvas.height) h = Math.max(MIN, canvas.height - y);
  return {
    id: newBlockId(),
    type: "TEXT",
    pageIndex,
    name: "Texto",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex: nextZIndex(blocks),
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      content: "",
      fontFamily: "Helvetica",
      fontSize,
      fontWeight: 600,
      lineHeight,
      letterSpacing: 0,
      textAlign: "LEFT",
      color: "#111827",
    },
  };
}

/** Usa una key del catálogo V1 para compatibilidad con guardado y preview. */
export function createDefaultVariableTextBlock(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex = 0
): TemplateV2Block {
  const w = Math.min(720, Math.max(120, canvas.width - 48));
  const lineHeight = 1.2;
  const fontSize = 36;
  const h = textBoxHeightForLine(fontSize, lineHeight);
  const { x, y, zIndex } = placeBlock({ canvas, blocks, width: w, height: h });
  return {
    id: newBlockId(),
    type: "VARIABLE_TEXT",
    pageIndex,
    name: "Variable",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      variableKey: "student.fullName",
      fallback: "Nombre",
      fontFamily: "Helvetica",
      fontSize,
      fontWeight: 500,
      lineHeight,
      letterSpacing: 0,
      textAlign: "CENTER",
      color: "#334155",
    },
  };
}

export function createDefaultShapeBlock(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex = 0
): TemplateV2Block {
  const w = 420;
  const h = 140;
  const { x, y, zIndex } = placeBlock({ canvas, blocks, width: w, height: h });
  return {
    id: newBlockId(),
    type: "SHAPE",
    pageIndex,
    name: "Forma",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      variant: "rectangle",
      fill: "#e2e8f0",
      stroke: "#64748b",
      strokeWidth: 2,
      radius: 14,
    },
  };
}

/** Bloque de fondo a tamaño lienzo; zIndex 0 para quedar detrás del resto. */
export function createDefaultBackgroundBlock(canvas: TemplateV2Canvas, pageIndex = 0): TemplateV2Block {
  return {
    id: newBlockId(),
    type: "BACKGROUND",
    pageIndex,
    name: "Fondo",
    layout: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      zIndex: 0,
      opacity: 1,
      locked: true,
      visible: true,
    },
    configJson: {
      backgroundColor: typeof canvas.background === "string" ? canvas.background : "#ffffff",
      src: "",
      fit: "cover",
    },
  };
}

export function createDefaultImageBlock(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex = 0
): TemplateV2Block {
  const w = 280;
  const h = 200;
  const { x, y, zIndex } = placeBlock({ canvas, blocks, width: w, height: h });
  return {
    id: newBlockId(),
    type: "IMAGE",
    pageIndex,
    name: "Imagen",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      src: "",
      fit: "cover",
      borderRadius: 10,
      photoMode: "free",
      maskShape: "rect",
    },
  };
}

/** Logo institucional: URL resuelta en runtime desde el alta de la escuela (PNG con fondo transparente). */
export function createDefaultSchoolLogoImageBlock(
  canvas: TemplateV2Canvas,
  blocks: TemplateV2Block[],
  pageIndex = 0
): TemplateV2Block {
  const w = 220;
  const h = 140;
  const { x, y, zIndex } = placeBlock({ canvas, blocks, width: w, height: h });
  return {
    id: newBlockId(),
    type: "IMAGE",
    pageIndex,
    name: "Logo escuela",
    layout: {
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      zIndex,
      opacity: 1,
      locked: false,
      visible: true,
    },
    configJson: {
      src: "",
      fit: "cover",
      borderRadius: 0,
      photoMode: "free",
      maskShape: "rect",
      source: { variableKey: "branding.schoolLogoUrl" },
    },
  };
}
