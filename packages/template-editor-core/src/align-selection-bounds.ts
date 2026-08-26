import { clampBlockPosition } from "@/lib/template-v2/clamp-block-position";
import type { CanvasQuickAlignment } from "@/lib/template-v2/align-block-to-canvas";
import type { TemplateV2Block } from "@/lib/template-v2/render-core";

/** Bounding box del conjunto (ejes alineados al layout; sin rotación). */
export type SelectionAxisBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function getSelectionAxisBounds(
  blocks: TemplateV2Block[],
  selectedIds: readonly string[]
): SelectionAxisBounds | null {
  const idSet = new Set(selectedIds);
  const selected = blocks.filter((b) => idSet.has(b.id));
  if (selected.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of selected) {
    const { x, y, width, height } = b.layout;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  return { minX, minY, maxX, maxY };
}

export function anySelectedBlockLocked(blocks: TemplateV2Block[], selectedIds: readonly string[]): boolean {
  const idSet = new Set(selectedIds);
  return blocks.some((b) => idSet.has(b.id) && (b.layout.locked ?? false));
}

/**
 * Alinea cada bloque seleccionado al rectángulo del conjunto (min/max de bordes).
 * Requiere al menos 2 ids seleccionados; si no, devuelve `blocks` sin cambios.
 */
export function alignBlocksToSelectionBounds(
  alignment: CanvasQuickAlignment,
  canvasWidth: number,
  canvasHeight: number,
  blocks: TemplateV2Block[],
  selectedIds: readonly string[]
): TemplateV2Block[] {
  const idSet = new Set(selectedIds);
  const selected = blocks.filter((b) => idSet.has(b.id));
  if (selected.length < 2) return blocks;

  const bounds = getSelectionAxisBounds(blocks, selectedIds);
  if (!bounds) return blocks;

  const { minX, minY, maxX, maxY } = bounds;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const nextPos = new Map<string, { x: number; y: number }>();
  for (const b of selected) {
    const { width, height } = b.layout;
    let x = b.layout.x;
    let y = b.layout.y;
    switch (alignment) {
      case "left":
        x = minX;
        break;
      case "right":
        x = maxX - width;
        break;
      case "center-x":
        x = centerX - width / 2;
        break;
      case "top":
        y = minY;
        break;
      case "bottom":
        y = maxY - height;
        break;
      case "center-y":
        y = centerY - height / 2;
        break;
      default:
        break;
    }
    const c = clampBlockPosition(canvasWidth, canvasHeight, x, y, width, height);
    nextPos.set(b.id, { x: c.x, y: c.y });
  }

  return blocks.map((b) => {
    const p = nextPos.get(b.id);
    if (!p) return b;
    return { ...b, layout: { ...b.layout, x: p.x, y: p.y } };
  });
}

export type DistributeAxis = "horizontal" | "vertical";

function sortSelectedStableByX(selected: TemplateV2Block[]): TemplateV2Block[] {
  return [...selected].sort((a, b) => {
    const dx = a.layout.x - b.layout.x;
    if (Math.abs(dx) > 1e-6) return dx;
    return a.id.localeCompare(b.id);
  });
}

function sortSelectedStableByY(selected: TemplateV2Block[]): TemplateV2Block[] {
  return [...selected].sort((a, b) => {
    const dy = a.layout.y - b.layout.y;
    if (Math.abs(dy) > 1e-6) return dy;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Distribuye el espacio libre con **separación uniforme** entre bloques adyacentes (entre bordes).
 * Usa la caja envolvente del conjunto: borde izquierdo mínimo y borde derecho máximo (horizontal),
 * o superior mínimo e inferior máximo (vertical). Ordena por posición en ese eje con desempate por id.
 * No modifica nada si hay algún bloque locked entre los seleccionados.
 * Requiere al menos 3 bloques seleccionados.
 */
export function distributeBlocksInSelection(
  axis: DistributeAxis,
  canvasWidth: number,
  canvasHeight: number,
  blocks: TemplateV2Block[],
  selectedIds: readonly string[]
): TemplateV2Block[] {
  const idSet = new Set(selectedIds);
  const selected = blocks.filter((b) => idSet.has(b.id));
  if (selected.length < 3) return blocks;

  if (anySelectedBlockLocked(blocks, selectedIds)) {
    return blocks;
  }

  const n = selected.length;

  if (axis === "horizontal") {
    const minLeft = Math.min(...selected.map((b) => b.layout.x));
    const maxRight = Math.max(...selected.map((b) => b.layout.x + b.layout.width));
    const sorted = sortSelectedStableByX(selected);
    const totalWidths = sorted.reduce((acc, b) => acc + b.layout.width, 0);
    const span = maxRight - minLeft;
    const innerSpace = span - totalWidths;
    const gap = innerSpace / (n - 1);

    let currentX = minLeft;
    const nextPos = new Map<string, { x: number; y: number }>();
    for (const b of sorted) {
      const { width, height } = b.layout;
      const c = clampBlockPosition(canvasWidth, canvasHeight, currentX, b.layout.y, width, height);
      nextPos.set(b.id, { x: c.x, y: c.y });
      currentX += width + gap;
    }

    return blocks.map((block) => {
      const p = nextPos.get(block.id);
      if (!p) return block;
      return { ...block, layout: { ...block.layout, x: p.x, y: p.y } };
    });
  }

  const minTop = Math.min(...selected.map((b) => b.layout.y));
  const maxBottom = Math.max(...selected.map((b) => b.layout.y + b.layout.height));
  const sorted = sortSelectedStableByY(selected);
  const totalHeights = sorted.reduce((acc, b) => acc + b.layout.height, 0);
  const span = maxBottom - minTop;
  const innerSpace = span - totalHeights;
  const gap = innerSpace / (n - 1);

  let currentY = minTop;
  const nextPos = new Map<string, { x: number; y: number }>();
  for (const b of sorted) {
    const { width, height } = b.layout;
    const c = clampBlockPosition(canvasWidth, canvasHeight, b.layout.x, currentY, width, height);
    nextPos.set(b.id, { x: c.x, y: c.y });
    currentY += height + gap;
  }

  return blocks.map((block) => {
    const p = nextPos.get(block.id);
    if (!p) return block;
    return { ...block, layout: { ...block.layout, x: p.x, y: p.y } };
  });
}
