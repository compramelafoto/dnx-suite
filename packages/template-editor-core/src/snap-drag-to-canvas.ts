import { clampBlockPosition } from "./clamp-block-position";
import type { TemplateV2Block } from "./render-core";

/**
 * Distancia máxima (px en espacio de lienzo) para activar snap al arrastrar.
 * ~9px: imán útil (tipo Canva/Figma) sin saltos bruscos; mismo valor para lienzo y bloques.
 */
export const CANVAS_DRAG_SNAP_THRESHOLD_PX = 9;

/** Con Shift el imán es fuerte: atrae desde más lejos. */
export const CANVAS_DRAG_MAGNET_THRESHOLD_PX = 28;

export type SnapDragOptions = {
  /**
   * Imán fuerte (tecla Shift): más distancia de atracción, bordes enfrentados (pegar un bloque
   * al costado de otro) y las líneas de ayuda extra.
   */
  magnet?: boolean;
  /** Líneas de ayuda verticales y horizontales (por ejemplo, la zona segura). */
  guidesX?: number[];
  guidesY?: number[];
};

type SnapCandidate = { target: number; guide: number };

function pickClosestSnap(
  value: number,
  candidates: SnapCandidate[],
  threshold: number
): { snapped: number; guide: number | null } {
  let best: SnapCandidate | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(value - c.target);
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  if (!best) return { snapped: value, guide: null };
  return { snapped: best.target, guide: best.guide };
}

export type CanvasDragSnapResult = {
  x: number;
  y: number;
  /** Posición X en el lienzo de la línea guía vertical (null si no aplica). */
  guideVerticalX: number | null;
  /** Posición Y en el lienzo de la línea guía horizontal (null si no aplica). */
  guideHorizontalY: number | null;
};

function buildCanvasXCandidates(canvasWidth: number, blockWidth: number): SnapCandidate[] {
  return [
    { target: 0, guide: 0 },
    { target: canvasWidth / 2 - blockWidth / 2, guide: canvasWidth / 2 },
    { target: canvasWidth - blockWidth, guide: canvasWidth },
  ];
}

function buildCanvasYCandidates(canvasHeight: number, blockHeight: number): SnapCandidate[] {
  return [
    { target: 0, guide: 0 },
    { target: canvasHeight / 2 - blockHeight / 2, guide: canvasHeight / 2 },
    { target: canvasHeight - blockHeight, guide: canvasHeight },
  ];
}

/** Alineaciones paralelas: izq–izq, centro–centro, der–der (mismas “caras”). */
function pushBlockSnapCandidates(
  xCandidates: SnapCandidate[],
  yCandidates: SnapCandidate[],
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  blockWidth: number,
  blockHeight: number
): void {
  xCandidates.push(
    { target: ox, guide: ox },
    { target: ox + ow / 2 - blockWidth / 2, guide: ox + ow / 2 },
    { target: ox + ow - blockWidth, guide: ox + ow }
  );
  yCandidates.push(
    { target: oy, guide: oy },
    { target: oy + oh / 2 - blockHeight / 2, guide: oy + oh / 2 },
    { target: oy + oh - blockHeight, guide: oy + oh }
  );
}

/** Bordes enfrentados: el borde izquierdo de uno contra el derecho del otro, arriba contra abajo. */
function pushFacingEdgeCandidates(
  xCandidates: SnapCandidate[],
  yCandidates: SnapCandidate[],
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  blockWidth: number,
  blockHeight: number
): void {
  xCandidates.push({ target: ox + ow, guide: ox + ow }, { target: ox - blockWidth, guide: ox });
  yCandidates.push({ target: oy + oh, guide: oy + oh }, { target: oy - blockHeight, guide: oy });
}

/** Una línea de ayuda atrae los dos bordes y el centro del bloque. */
function pushGuideCandidates(candidates: SnapCandidate[], guides: number[], size: number): void {
  for (const g of guides) {
    candidates.push({ target: g, guide: g }, { target: g - size, guide: g }, { target: g - size / 2, guide: g });
  }
}

/**
 * Snap al mover: lienzo + otros bloques visibles (misma tolerancia por eje; gana el candidato más cercano).
 * No cruza bordes (solo izq–izq, centro–centro, etc.).
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
  options: SnapDragOptions = {}
): CanvasDragSnapResult {
  const xCandidates: SnapCandidate[] = [...buildCanvasXCandidates(canvasWidth, blockWidth)];
  const yCandidates: SnapCandidate[] = [...buildCanvasYCandidates(canvasHeight, blockHeight)];

  for (const b of blocks) {
    if (b.id === draggedBlockId) continue;
    if (!b.layout.visible) continue;
    const { x: ox, y: oy, width: ow, height: oh } = b.layout;
    pushBlockSnapCandidates(xCandidates, yCandidates, ox, oy, ow, oh, blockWidth, blockHeight);
    if (options.magnet) pushFacingEdgeCandidates(xCandidates, yCandidates, ox, oy, ow, oh, blockWidth, blockHeight);
  }
  if (options.magnet) {
    pushGuideCandidates(xCandidates, options.guidesX ?? [], blockWidth);
    pushGuideCandidates(yCandidates, options.guidesY ?? [], blockHeight);
  }

  const threshold = options.magnet ? Math.max(thresholdPx, CANVAS_DRAG_MAGNET_THRESHOLD_PX) : thresholdPx;
  const sx = pickClosestSnap(rawX, xCandidates, threshold);
  const sy = pickClosestSnap(rawY, yCandidates, threshold);

  const clamped = clampBlockPosition(canvasWidth, canvasHeight, sx.snapped, sy.snapped, blockWidth, blockHeight);

  return {
    x: clamped.x,
    y: clamped.y,
    guideVerticalX: sx.guide,
    guideHorizontalY: sy.guide,
  };
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
