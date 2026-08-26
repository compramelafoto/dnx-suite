import type { TemplateV2Canvas } from "./render-core";

/** Centro del lienzo en coordenadas de canvas (px). Útil para guías fijas de referencia. */
export function getCanvasCenterPoint(canvas: Pick<TemplateV2Canvas, "width" | "height">): { cx: number; cy: number } {
  return { cx: canvas.width / 2, cy: canvas.height / 2 };
}
