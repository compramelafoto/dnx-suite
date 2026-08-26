import { clampBlockPosition } from "@/lib/template-v2/clamp-block-position";
import type { TemplateV2Block } from "@/lib/template-v2/render-core";

/**
 * Distancia máxima (px en espacio de lienzo) para activar snap al arrastrar.
 * ~9px: imán útil (tipo Canva/Figma) sin saltos bruscos; mismo valor para lienzo y bloques.
 */
export const CANVAS_DRAG_SNAP_THRESHOLD_PX = 9;

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
  thresholdPx: number = CANVAS_DRAG_SNAP_THRESHOLD_PX
): CanvasDragSnapResult {
  const xCandidates: SnapCandidate[] = [...buildCanvasXCandidates(canvasWidth, blockWidth)];
  const yCandidates: SnapCandidate[] = [...buildCanvasYCandidates(canvasHeight, blockHeight)];

  for (const b of blocks) {
    if (b.id === draggedBlockId) continue;
    if (!b.layout.visible) continue;
    const { x: ox, y: oy, width: ow, height: oh } = b.layout;
    pushBlockSnapCandidates(xCandidates, yCandidates, ox, oy, ow, oh, blockWidth, blockHeight);
  }

  const sx = pickClosestSnap(rawX, xCandidates, thresholdPx);
  const sy = pickClosestSnap(rawY, yCandidates, thresholdPx);

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
