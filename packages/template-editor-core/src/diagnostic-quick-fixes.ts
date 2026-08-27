import { clampBlockPosition } from "./clamp-block-position";
import { getSafeAreaRectPx } from "./get-safe-area-rect";
import { selectBlock, updateBlock, type TemplateV2EditorDispatch } from "./editor-store";
import type { TemplateV2Block, TemplateV2Canvas } from "./render-core";

const MIN_DIM = 24;

/** Centra el rect de layout en la zona segura y limita al lienzo (layout sin rotación). */
export function centerLayoutInSafeArea(
  canvas: TemplateV2Canvas,
  layout: { x: number; y: number; width: number; height: number }
): { x: number; y: number } {
  const safe = getSafeAreaRectPx(canvas);
  const { width: w, height: h } = layout;
  const nx = safe.x + (safe.width - w) / 2;
  const ny = safe.y + (safe.height - h) / 2;
  return clampBlockPosition(canvas.width, canvas.height, nx, ny, w, h);
}

/**
 * Si el bloque no solapa el lienzo, lo centra (luego clamp). Si ya solapa, solo aplica clamp al borde permitido.
 */
export function bringLayoutIntoCanvas(
  canvas: TemplateV2Canvas,
  layout: { x: number; y: number; width: number; height: number }
): { x: number; y: number } {
  const cw = canvas.width;
  const ch = canvas.height;
  const { x, y, width: w, height: h } = layout;
  const x2 = x + w;
  const y2 = y + h;
  const overlaps = x2 > 0 && x < cw && y2 > 0 && y < ch;
  if (overlaps) {
    return clampBlockPosition(cw, ch, x, y, w, h);
  }
  const nx = (cw - w) / 2;
  const ny = (ch - h) / 2;
  return clampBlockPosition(cw, ch, nx, ny, w, h);
}

export function getDiagnosticQuickFixLabel(code: string): string | null {
  const map: Record<string, string> = {
    hidden: "Mostrar",
    variable_no_key: "Ir al bloque",
    text_empty: "Seleccionar",
    image_no_src: "Seleccionar",
    safe_partial: "Ajustar a zona segura",
    safe_outside: "Ajustar a zona segura",
    tiny_block: "Tamaño mínimo",
    canvas_outside: "Traer al lienzo",
  };
  return map[code] ?? null;
}

export function applyDiagnosticQuickFix(
  dispatch: TemplateV2EditorDispatch,
  params: { code: string; blockId: string; blocks: TemplateV2Block[]; canvas: TemplateV2Canvas }
): void {
  const { code, blockId, blocks, canvas } = params;
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return;

  switch (code) {
    case "hidden":
      dispatch(updateBlock(blockId, { layout: { visible: true } }));
      return;
    case "variable_no_key":
    case "text_empty":
    case "image_no_src":
      dispatch(selectBlock(blockId));
      return;
    case "safe_partial":
    case "safe_outside": {
      const next = centerLayoutInSafeArea(canvas, block.layout);
      dispatch(updateBlock(blockId, { layout: { x: next.x, y: next.y } }));
      return;
    }
    case "tiny_block": {
      const w = Math.max(MIN_DIM, block.layout.width);
      const h = Math.max(MIN_DIM, block.layout.height);
      dispatch(updateBlock(blockId, { layout: { width: w, height: h } }));
      return;
    }
    case "canvas_outside": {
      const next = bringLayoutIntoCanvas(canvas, block.layout);
      dispatch(updateBlock(blockId, { layout: { x: next.x, y: next.y } }));
      return;
    }
    default:
      return;
  }
}
