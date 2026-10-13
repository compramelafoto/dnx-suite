import { clampBlockPosition } from "./clamp-block-position";
import type { TemplateV2Block } from "./render-core";

/**
 * Distancia por omisión (px del lienzo) para que el imán actúe. El editor no la usa: pasa una
 * distancia fija en pantalla convertida al zoom (ver `SNAP_SCREEN_PX`), porque 9 px del lienzo
 * son 2 px de pantalla con una carpeta al 25 % y el imán no se notaba.
 */
export const CANVAS_DRAG_SNAP_THRESHOLD_PX = 9;

/** Distancia del imán en px de pantalla, la misma con cualquier zoom. */
export const SNAP_SCREEN_PX = 8;

/** Piso del imán fuerte (Shift al mover), en px del lienzo. */
export const CANVAS_DRAG_MAGNET_THRESHOLD_PX = 28;

/** Con Shift el imán atrae desde unas tres veces y media más lejos que el normal. */
const MAGNET_FACTOR = 3.5;

export type CanvasDragSnapResult = {
  x: number;
  y: number;
  /** Posición X en el lienzo de la línea guía vertical (null si no aplica). */
  guideVerticalX: number | null;
  /** Posición Y en el lienzo de la línea guía horizontal (null si no aplica). */
  guideHorizontalY: number | null;
};

export type SnapOptions = {
  /** Rectángulo de la zona segura: sus bordes también imantan. */
  safeArea?: { x: number; y: number; width: number; height: number } | null;
  /** Imán fuerte (tecla Shift al mover): atrae desde más lejos. */
  magnet?: boolean;
  /** Líneas de ayuda extra, verticales y horizontales. */
  guidesX?: number[];
  guidesY?: number[];
};

/** Nombre anterior de las opciones; se conserva para quien ya lo use. */
export type SnapDragOptions = SnapOptions;

/**
 * Líneas guía del imán, en px del lienzo: bordes y centro de la hoja, bordes de la zona segura y
 * bordes y centro de cada bloque visible que no se está moviendo.
 */
export function buildSnapGuideLines(
  canvasWidth: number,
  canvasHeight: number,
  blocks: TemplateV2Block[],
  excludeIds: ReadonlySet<string>,
  options: SnapOptions = {}
): { xs: number[]; ys: number[] } {
  const xs = [0, canvasWidth / 2, canvasWidth];
  const ys = [0, canvasHeight / 2, canvasHeight];
  const sa = options.safeArea;
  if (sa) {
    xs.push(sa.x, sa.x + sa.width);
    ys.push(sa.y, sa.y + sa.height);
  }
  xs.push(...(options.guidesX ?? []));
  ys.push(...(options.guidesY ?? []));
  for (const b of blocks) {
    if (excludeIds.has(b.id) || !b.layout.visible) continue;
    // El fondo ocupa la hoja entera: sus bordes ya son los de la hoja.
    if (b.type === "BACKGROUND") continue;
    const { x, y, width: w, height: h } = b.layout;
    xs.push(x, x + w / 2, x + w);
    ys.push(y, y + h / 2, y + h);
  }
  return { xs, ys };
}

/**
 * Imán de un eje: prueba cada "cara" del bloque (inicio, centro, fin) contra cada guía y devuelve
 * el corrimiento más chico que deja alguna cara sobre una guía. Así un bloque se alinea por
 * cualquier lado y también queda pegado al costado de otro (mi izquierda con su derecha).
 */
function snapAxis(
  start: number,
  size: number,
  guides: number[],
  threshold: number
): { offset: number; guide: number | null } {
  const faces = [start, start + size / 2, start + size];
  let best: { offset: number; guide: number } | null = null;
  for (const f of faces) {
    for (const g of guides) {
      const d = g - f;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.offset))) {
        best = { offset: d, guide: g };
      }
    }
  }
  return best ?? { offset: 0, guide: null };
}

/**
 * Imán al mover: bordes y centro de la hoja, zona segura y otros bloques visibles. Gana, por eje,
 * la guía más cercana dentro de la tolerancia.
 */
export function snapDragPosition(
  canvasWidth: number,
  canvasHeight: number,
  blockWidth: number,
  blockHeight: number,
  rawX: number,
  rawY: number,
  draggedBlockId: string,
  blocks: TemplateV2Block[],
  thresholdPx: number = CANVAS_DRAG_SNAP_THRESHOLD_PX,
  options: SnapOptions = {}
): CanvasDragSnapResult {
  const { xs, ys } = buildSnapGuideLines(canvasWidth, canvasHeight, blocks, new Set([draggedBlockId]), options);
  const threshold = options.magnet
    ? Math.max(thresholdPx * MAGNET_FACTOR, CANVAS_DRAG_MAGNET_THRESHOLD_PX)
    : thresholdPx;
  const sx = snapAxis(rawX, blockWidth, xs, threshold);
  const sy = snapAxis(rawY, blockHeight, ys, threshold);

  const clamped = clampBlockPosition(
    canvasWidth,
    canvasHeight,
    rawX + sx.offset,
    rawY + sy.offset,
    blockWidth,
    blockHeight
  );

  return {
    x: clamped.x,
    y: clamped.y,
    guideVerticalX: sx.guide,
    guideHorizontalY: sy.guide,
  };
}

export type SnapResizeResult = {
  rect: { x: number; y: number; width: number; height: number };
  guideVerticalX: number | null;
  guideHorizontalY: number | null;
};

/**
 * Imán al cambiar el tamaño desde una esquina: los dos bordes que se mueven se pegan a la guía
 * más cercana y el borde opuesto queda quieto. Con proporción fija se imanta sólo el eje que
 * quedó más cerca y el otro lado acompaña, para no deformar.
 */
export function snapResizeRect(
  handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w",
  rect: { x: number; y: number; width: number; height: number },
  guides: { xs: number[]; ys: number[] },
  thresholdPx: number,
  keepAspect: boolean,
  minSide = 24
): SnapResizeResult {
  const movesLeft = handle === "nw" || handle === "sw" || handle === "w";
  const movesTop = handle === "nw" || handle === "ne" || handle === "n";
  // Un lado mueve un solo borde: el otro eje no se imanta.
  const movesX = handle !== "n" && handle !== "s";
  const movesY = handle !== "e" && handle !== "w";
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const edgeX = movesLeft ? left : right;
  const edgeY = movesTop ? top : bottom;

  const nearest = (v: number, list: number[]) => {
    let best: number | null = null;
    for (const g of list) {
      if (Math.abs(g - v) <= thresholdPx && (best === null || Math.abs(g - v) < Math.abs(best - v))) best = g;
    }
    return best;
  };
  let gx = movesX ? nearest(edgeX, guides.xs) : null;
  let gy = movesY ? nearest(edgeY, guides.ys) : null;

  if (keepAspect && gx !== null && gy !== null) {
    // Las dos guías no pueden cumplirse a la vez sin deformar: queda la más cercana.
    if (Math.abs(gx - edgeX) <= Math.abs(gy - edgeY)) gy = null;
    else gx = null;
  }

  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;
  const ratio = rect.width / rect.height;

  if (gx !== null) {
    width = movesLeft ? right - gx : gx - left;
    if (width < minSide) {
      width = rect.width;
      gx = null;
    } else if (movesLeft) x = gx;
    if (keepAspect && gx !== null) {
      height = width / ratio;
      if (movesTop) y = bottom - height;
    }
  }
  if (gy !== null) {
    height = movesTop ? bottom - gy : gy - top;
    if (height < minSide) {
      height = rect.height;
      gy = null;
    } else if (movesTop) y = gy;
    if (keepAspect && gy !== null) {
      width = height * ratio;
      if (movesLeft) x = right - width;
    }
  }

  return { rect: { x, y, width, height }, guideVerticalX: gx, guideHorizontalY: gy };
}

/**
 * Solo snap al lienzo (sin otros bloques). Equivalente a `snapDragPosition` con lista vacía.
 */
export function snapDragPositionToCanvas(
  canvasWidth: number,
  canvasHeight: number,
  blockWidth: number,
  blockHeight: number,
  rawX: number,
  rawY: number,
  thresholdPx: number = CANVAS_DRAG_SNAP_THRESHOLD_PX
): CanvasDragSnapResult {
  return snapDragPosition(canvasWidth, canvasHeight, blockWidth, blockHeight, rawX, rawY, "", [], thresholdPx);
}
