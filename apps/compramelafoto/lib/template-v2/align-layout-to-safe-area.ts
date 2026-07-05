import type { CanvasQuickAlignment } from "@/lib/template-v2/align-block-to-canvas";
import { clampBlockPosition } from "@/lib/template-v2/clamp-block-position";
import { getSafeAreaRectPx } from "@/lib/template-v2/get-safe-area-rect";
import type { TemplateV2Canvas } from "@/lib/template-v2/render-core";

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Alinea el rectángulo de layout al borde interior de la zona segura (mismo criterio que `getSafeAreaRectPx`).
 * Solo mueve ejes que aplica la acción; el resultado se limita al lienzo completo con `clampBlockPosition`.
 */
export function alignLayoutToSafeArea(
  alignment: CanvasQuickAlignment,
  canvas: TemplateV2Canvas,
  layout: LayoutBox
): { x: number; y: number } {
  const safe = getSafeAreaRectPx(canvas);
  const { width: bw, height: bh } = layout;
  let x = layout.x;
  let y = layout.y;
  const sl = safe.x;
  const st = safe.y;
  const sw = safe.width;
  const sh = safe.height;

  switch (alignment) {
    case "left":
      x = sl;
      break;
    case "center-x":
      x = sl + (sw - bw) / 2;
      break;
    case "right":
      x = sl + sw - bw;
      break;
    case "top":
      y = st;
      break;
    case "center-y":
      y = st + (sh - bh) / 2;
      break;
    case "bottom":
      y = st + sh - bh;
      break;
    default:
      break;
  }

  return clampBlockPosition(canvas.width, canvas.height, x, y, bw, bh);
}
